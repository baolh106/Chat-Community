import { createSign } from "node:crypto";
import { BadRequestError } from "../../shared/utils/error";
import type {
  IFileStorage,
  StoredFile,
  UploadFileInput,
} from "../../modules/message/application/ports/file-storage.port";
import {
  googleDriveFolderId,
  googleDriveMakePublic,
  googleDriveOAuthClientId,
  googleDriveOAuthClientSecret,
  googleDriveOAuthRefreshToken,
  googleDrivePrivateKey,
  googleDriveServiceAccountEmail,
  googleDriveServiceAccountJson,
} from "../../config/env";

type GoogleServiceAccount = {
  client_email?: string;
  private_key?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type GoogleDriveUploadResponse = {
  id?: string;
  name?: string;
  mimeType?: string;
  webViewLink?: string;
  webContentLink?: string;
};

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

function hasOAuthConfig(): boolean {
  return Boolean(
    googleDriveOAuthClientId &&
      googleDriveOAuthClientSecret &&
      googleDriveOAuthRefreshToken,
  );
}

function base64Url(value: Buffer | string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function parseServiceAccount(): Required<GoogleServiceAccount> {
  if (googleDriveServiceAccountJson) {
    let parsed: GoogleServiceAccount;
    try {
      parsed = JSON.parse(
        googleDriveServiceAccountJson,
      ) as GoogleServiceAccount;
    } catch {
      throw new BadRequestError("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is invalid");
    }
    if (parsed.client_email && parsed.private_key) {
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
      };
    }
  }
  if (googleDriveServiceAccountEmail && googleDrivePrivateKey) {
    return {
      client_email: googleDriveServiceAccountEmail,
      private_key: googleDrivePrivateKey,
    };
  }

  throw new BadRequestError("Google Drive storage is not configured");
}

function getFileType(mimeType: string): StoredFile["type"] {
  return mimeType.startsWith("image/") ? "image" : "file";
}

export class GoogleDriveFileStorage implements IFileStorage {
  private accessToken: string | null = null;
  private expiresAt = 0;

  constructor(private readonly folderId: string = googleDriveFolderId) {}

  async upload(file: UploadFileInput): Promise<StoredFile> {
    if (!this.folderId) {
      throw new BadRequestError("GOOGLE_DRIVE_FOLDER_ID is missing");
    }

    const accessToken = await this.getAccessToken();
    const metadata = {
      name: file.originalName,
      parents: [this.folderId],
    };

    const boundary = `chat-community-${Date.now()}`;
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
          `${JSON.stringify(metadata)}\r\n` +
          `--${boundary}\r\n` +
          `Content-Type: ${file.mimeType}\r\n\r\n`,
      ),
      file.buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploadUrl =
      `${DRIVE_UPLOAD_URL}?uploadType=multipart` +
      "&fields=id,name,mimeType,webViewLink,webContentLink";
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      throw new BadRequestError(await this.readGoogleError(response));
    }

    const uploaded = (await response.json()) as GoogleDriveUploadResponse;
    if (!uploaded.id || !uploaded.webViewLink) {
      throw new BadRequestError(
        "Google Drive upload did not return a file link",
      );
    }

    if (googleDriveMakePublic) {
      await this.makeFilePublic(uploaded.id, accessToken);
    }

    return {
      driveId: uploaded.id,
      url: uploaded.webViewLink,
      downloadUrl: uploaded.webContentLink ?? null,
      name: uploaded.name ?? file.originalName,
      mimeType: uploaded.mimeType ?? file.mimeType,
      size: file.size,
      type: getFileType(file.mimeType),
    };
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt - 60_000) {
      return this.accessToken;
    }

    if (hasOAuthConfig()) {
      return await this.getOAuthAccessToken();
    }

    const account = parseServiceAccount();
    const now = Math.floor(Date.now() / 1000);
    const assertion = this.createJwtAssertion(account, now);
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });

    const payload = (await response.json()) as GoogleTokenResponse;
    if (!response.ok || !payload.access_token) {
      throw new BadRequestError(
        payload.error_description ??
          payload.error ??
          "Google Drive authentication failed",
      );
    }

    this.accessToken = payload.access_token;
    this.expiresAt = Date.now() + 55 * 60 * 1000;
    return this.accessToken;
  }

  private async getOAuthAccessToken(): Promise<string> {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: googleDriveOAuthClientId,
        client_secret: googleDriveOAuthClientSecret,
        refresh_token: googleDriveOAuthRefreshToken,
        grant_type: "refresh_token",
      }),
    });

    const payload = (await response.json()) as GoogleTokenResponse;
    if (!response.ok || !payload.access_token) {
      throw new BadRequestError(
        payload.error_description ??
          payload.error ??
          "Google Drive OAuth authentication failed",
      );
    }

    this.accessToken = payload.access_token;
    this.expiresAt =
      Date.now() + Math.max((payload.expires_in ?? 3600) - 60, 60) * 1000;
    return this.accessToken;
  }

  private createJwtAssertion(
    account: Required<GoogleServiceAccount>,
    issuedAt: number,
  ): string {
    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claimSet = base64Url(
      JSON.stringify({
        iss: account.client_email,
        scope: DRIVE_SCOPE,
        aud: TOKEN_URL,
        exp: issuedAt + 3600,
        iat: issuedAt,
      }),
    );
    const unsignedJwt = `${header}.${claimSet}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsignedJwt);
    signer.end();
    const signature = base64Url(signer.sign(account.private_key));
    return `${unsignedJwt}.${signature}`;
  }

  private async makeFilePublic(
    fileId: string,
    accessToken: string,
  ): Promise<void> {
    const response = await fetch(`${DRIVE_FILES_URL}/${fileId}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "reader",
        type: "anyone",
      }),
    });

    if (!response.ok) {
      throw new BadRequestError(await this.readGoogleError(response));
    }
  }

  private async readGoogleError(response: Response): Promise<string> {
    const text = await response.text();
    return text || `Google Drive request failed with ${response.status}`;
  }
}

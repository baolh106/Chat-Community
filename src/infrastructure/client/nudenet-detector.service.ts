import axios, { type AxiosInstance } from "axios";
import { detectorServiceUrl, imageDetectorApiKey } from "../../config/env";
import type {
  IImageDetectorService,
  ImageDetectorResponse,
} from "../../modules/message/application/ports/image-detector.port";
import { createLogger } from "../../shared/logging/logger";

const logger = createLogger("image-detector");

export class NudeNetDetectorService implements IImageDetectorService {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: detectorServiceUrl,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": imageDetectorApiKey, // Header mà validate_api_key ở Python mong đợi
      },
      timeout: 10000, // Kiểm duyệt ảnh thường tốn thời gian, để timeout 10s
    });
  }

  async scanImage(imageUrl: string): Promise<ImageDetectorResponse> {
    try {
      const response = await this.client.post<ImageDetectorResponse>("/api/v1/detect", {
        image_url: imageUrl,
      });

      return response.data;
    } catch (error: any) {
      logger.error("image scan failed", {
        err: error,
        status: error.response?.status,
      });

      throw new Error(
        error.response?.data?.message ||
          "Failed to communicate with image detection service",
        { cause: error },
      );
    }
  }
}

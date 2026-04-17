export type UserSessionStartRequest = {
  nickname: string;
  identifierNumber: string;
};

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

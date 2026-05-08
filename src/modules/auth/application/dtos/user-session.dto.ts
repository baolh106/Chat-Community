export type UserSessionStartRequest = {
  nickname: string;
};

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type SocketSessionData = {
  role?: RoleType;
  userId?: string;
  /** userID = "nickname"_"identifierNumber" */
  nickname?: string;
  identifierNumber?: string;
};

export type SocketPayload = {
  nickname: string;
  identifierNumber: number;
};

export type RoleType = "admin" | "user";

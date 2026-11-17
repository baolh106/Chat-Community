export type SocketSessionData = {
  role?: RoleType;
  userId?: string;
  /** userID = "nickname" + unique session suffix */
  nickname?: string;
  joined?: boolean;
};

export type SocketPayload = {
  nickname: string;
};

export type RoleType = "admin" | "user";

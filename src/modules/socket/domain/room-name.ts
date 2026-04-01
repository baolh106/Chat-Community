export const ADMIN_ROOM = "admin";

export function userRoom(userId: string): string {
  return `user:${userId}`;
}
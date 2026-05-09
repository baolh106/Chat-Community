import type { UserJoinedPayload } from "../../../auth/domain/events/user-joined.event";

export interface IToolNotifier {
  getNameTool(): string;
  notifyUserJoined(payload: UserJoinedPayload): Promise<void>;
}

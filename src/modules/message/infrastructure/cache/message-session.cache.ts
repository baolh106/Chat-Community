import { randomUUID } from "node:crypto";
import type { RedisClient } from "../../../../infrastructure/redis";
import type { MessageCreate } from "../../application/dtos/param";
import type { IMessageSessionCache } from "../../application/ports/message-session-cache.port";
import { MessageSession } from "../../constant/constant";

const APPEND_SCRIPT = `
local added = 0
for i = 2, #ARGV, 2 do
  if redis.call('SADD', KEYS[2], ARGV[i]) == 1 then
    redis.call('RPUSH', KEYS[1], ARGV[i + 1])
    added = added + 1
  end
end
redis.call('EXPIRE', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[2], ARGV[1])
return added
`;

const UNREAD_SCRIPT = `
local len = redis.call('LLEN', KEYS[1])
local prev = tonumber(redis.call('HGET', KEYS[2], ARGV[1]) or '0')
if prev > len then prev = len end
local count = 0
if len > prev then
  local items = redis.call('LRANGE', KEYS[1], prev, len - 1)
  for _, raw in ipairs(items) do
    local ok, msg = pcall(cjson.decode, raw)
    if ok and type(msg) == 'table' and msg['receiver'] == ARGV[1] then
      count = count + 1
    end
  end
end
if ARGV[3] == '1' and len > prev then
  redis.call('HSET', KEYS[2], ARGV[1], len)
  redis.call('EXPIRE', KEYS[2], ARGV[2])
end
return count
`;

type CachedMessage = Omit<MessageCreate, "createdAt" | "isRead"> & {
  createdAt: string;
};

export class MessageSessionCache implements IMessageSessionCache {
  constructor(
    private readonly _redis: RedisClient,
    private readonly _ttlSeconds: number = MessageSession.CACHE_TTL_SECONDS,
  ) {}

  async appendMessages(
    conversationKey: string,
    messages: MessageCreate[],
  ): Promise<number> {
    if (messages.length === 0) return 0;

    const args: Array<string | number> = [this._ttlSeconds];
    for (const message of messages) {
      const id = message.id ?? randomUUID();
      args.push(id, JSON.stringify(this.toCached({ ...message, id })));
    }

    const added = await this._redis.eval(
      APPEND_SCRIPT,
      [this.listKey(conversationKey), this.idsKey(conversationKey)],
      args,
    );
    return Number(added);
  }

  async getMessages(conversationKey: string): Promise<MessageCreate[]> {
    const [rawItems, readMarks] = await Promise.all([
      this._redis.lrange(this.listKey(conversationKey), 0, -1),
      this._redis.hgetall(this.readKey(conversationKey)),
    ]);

    const messages: MessageCreate[] = [];
    rawItems.forEach((raw, index) => {
      const cached = this.parse(raw);
      if (!cached) return;
      const readUpTo = Number(readMarks[cached.receiver] ?? 0);
      messages.push({
        ...cached,
        createdAt: new Date(cached.createdAt),
        isRead: index < readUpTo,
      });
    });
    return messages;
  }

  async markMessagesAsRead(
    conversationKey: string,
    readerId: string,
  ): Promise<number> {
    return await this.runUnread(conversationKey, readerId, true);
  }

  async getUnreadCount(
    conversationKey: string,
    readerId: string,
  ): Promise<number> {
    return await this.runUnread(conversationKey, readerId, false);
  }

  async deleteMessages(conversationKey: string): Promise<void> {
    await this._redis.del(
      this.listKey(conversationKey),
      this.idsKey(conversationKey),
      this.readKey(conversationKey),
    );
  }

  private async runUnread(
    conversationKey: string,
    readerId: string,
    commit: boolean,
  ): Promise<number> {
    const result = await this._redis.eval(
      UNREAD_SCRIPT,
      [this.listKey(conversationKey), this.readKey(conversationKey)],
      [readerId, this._ttlSeconds, commit ? "1" : "0"],
    );
    return Number(result);
  }

  private toCached(message: MessageCreate): CachedMessage {
    const { isRead: _isRead, createdAt, ...rest } = message;
    return {
      ...rest,
      createdAt:
        createdAt instanceof Date
          ? createdAt.toISOString()
          : new Date(createdAt).toISOString(),
    };
  }

  private parse(raw: string): CachedMessage | null {
    try {
      const value = JSON.parse(raw) as CachedMessage;
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  }

  private listKey(conversationKey: string): string {
    return `${MessageSession.CACHE_KEY_PREFIX}:${conversationKey}:list`;
  }

  private idsKey(conversationKey: string): string {
    return `${MessageSession.CACHE_KEY_PREFIX}:${conversationKey}:ids`;
  }

  private readKey(conversationKey: string): string {
    return `${MessageSession.CACHE_KEY_PREFIX}:${conversationKey}:read`;
  }
}

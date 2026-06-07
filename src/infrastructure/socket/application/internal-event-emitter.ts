import { EventEmitter } from "node:events";

/**
 * EventEmitter dùng để điều phối các tín hiệu nội bộ giữa các Layer 
 * mà không làm phụ thuộc trực tiếp các Class vào nhau.
 */
export const internalEvents = new EventEmitter();
export const OUTBOX_NOTIFY_EVENT = "OUTBOX_RECORD_ADDED";
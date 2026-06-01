# Message Read/Unread Update for Frontend

## Mục tiêu
Thêm trạng thái đọc/chưa đọc cho từng tin nhắn trong cuộc trò chuyện và cung cấp API cho FE:
- Lấy danh sách tin nhắn kèm `isRead`
- Đánh dấu tin nhắn đã đọc
- Lấy số lượng tin nhắn chưa đọc

## API mới
Base route: `/message`

### 1. Lấy danh sách tin nhắn trong cuộc trò chuyện
`GET /message/list/:conversationKey`

- `conversationKey`: giá trị định danh cuộc trò chuyện, hiện tại dùng chung với `userId`.
- Trả về tất cả tin nhắn trong cuộc trò chuyện đó.
- Mỗi tin nhắn có thêm trường `isRead: boolean`.

Example response:
```json
{
  "success": true,
  "message": "Get messages successful",
  "data": [
    {
      "content": "Hello",
      "sender": "admin",
      "receiver": "user123",
      "createdAt": "2026-06-01T07:00:00.000Z",
      "isRead": false
    }
  ]
}
```

### 2. Đánh dấu tin nhắn đã đọc
`POST /message/mark-read`

Request body:
```json
{
  "conversationKey": "user123",
  "readerId": "user123"
}
```

- `conversationKey`: conversation của cả 2 bên
- `readerId`: người vừa đọc tin nhắn hiện tại; chỉ các tin nhắn có `receiver === readerId` mới bị cập nhật `isRead: true`

Response:
```json
{
  "success": true,
  "message": "Mark read successful",
  "data": {
    "updatedCount": 5
  }
}
```

### 3. Lấy số lượng tin nhắn chưa đọc
`GET /message/unread-count/:conversationKey?readerId=user123`

- Trả về số lượng tin nhắn trong conversation hiện chưa đọc với vai trò người nhận là `readerId`.

Example response:
```json
{
  "success": true,
  "message": "Get unread count successful",
  "data": {
    "unreadCount": 3
  }
}
```

## Gợi ý FE
- Khi mở cuộc trò chuyện, gọi `GET /message/list/:conversationKey` để lấy tin nhắn và hiển thị `isRead`.
- Khi người dùng xem xong cuộc trò chuyện, gọi `POST /message/mark-read` để cập nhật trạng thái.
- Nếu cần badge chưa đọc, gọi `GET /message/unread-count/:conversationKey?readerId=<currentUserId>`.

## Lưu ý
- `isRead` được lưu trong cache Redis cục bộ theo `conversationKey`.
- Tin nhắn mới được tạo mặc định `isRead: false`.
- `readerId` có thể là `admin` nếu admin đang đọc tin nhắn, hoặc `user123` nếu người dùng đọc.

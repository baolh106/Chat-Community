1. Plan
- Lúc chat thì message sẽ lưu vào cache redis
- Bây giờ app tôi có tính năng là nếu user disconnect socket trên 10s thì sẽ thực hiện một function lưu tin nhắn với DB và ko xem được các tin nhắn đã nhắn phải start vơi một user mới, còn nếu socket quay lại trước 10s thì vẫn xem được tin nhắn cũ


- Thêm retry vào feature
- PM2 install notification telegram
- 
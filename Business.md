1. Build app chat community (nodejs + socket.io + clean architecture + surrealdb + redis)
2. Build UI cơ bản
3. Deploy theo parttern docker + nginx + cloudflare + ec2
4. Setup CI/CD trên Jenkins
5. Setup thông báo Telegram khi có tin nhắn đến + deploy
6. Mua domain free cho app gắn vào cloudflare

App chat với admin
sẽ chat theo phiên  session
VD: một người nhấn vào link => Bắt đầu chat với admin, nhưng admin sẽ không biết họ là ai, người ẩn danh, sau khi họ out session thì lịch sử trò chuyện cũng sẽ mất.
Tức là mỗi người sẽ bắt đầu chat với admin trong một room ngay thời điểm đó
bên phía admin sẽ thấy người user tham gia chat. Nếu user out page thì sẽ mất đoạn hội thoại của 2 bên trong 10s
- user có thể gửi ảnh nên có thể save lại ở Database
- database dùng surrealDB cloud 
- đối với admin khi out page thì ko ảnh hưởng, sau 1 thời gian vô lại vẫn bình thường sẽ còn trong room các user đang ở session của họ
- khi có thông báo tin nhắn tới admin, sẽ xem 1 notification qua telegram báo là có tin nhắn mới, bởi vì admin không phải lúc nào cũng ở page
- app này không cần login nên chia 2 page user và admin cho tiện
- database lưu log các tin nhắn lại, cần thiết thì admin có thể xem, check log
- apply swagger để generate doc cho FE
- Dùng để monitor Observability: opentelemetry

Thực hành riêng về Terraform  với DigitalOcean
5. Infrastructure cloud VPC + EC2 + S3 + RDS + Terraform
### 1. Project
- App chat community

### 2. Role Agent
- Senior Back-End + Solutions Architecture

### 3. Skill Agent
- Clean Architecture (hexagonal)
- Nodejs
- Socket.io
- Event-Driven Architecture (EDA)
- DI
- SOLID
- Optimize Performance

### 4. Tasks
- Chỉ ra đoạn code nào đang gặp phải vấn đề bên dưới
- Show code và cách để cải thiện chúng

### 5. Need improve
- Coupling runtime ở socket layer có khả năng tiềm ẩn

attachSocketServer nhận sessionManager, messageApplication, và eventBus dưới dạng optional, có thể che lấp dependency thiếu.
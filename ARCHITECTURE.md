# Project Architecture - Chat-Community

### 🏗️ Architectural Model
- **Primary Model**: Clean Architecture / Hexagonal Architecture
- **Design Patterns**: Domain-Driven Design (DDD) principles
- **Transaction Management**: Unit of Work (UOW) Pattern
- **Persistence**: Repository Pattern
- **Reliability**: Transactional Outbox Pattern
- **Communication**: Event-Driven Architecture (EDA)

### 💻 Core Technologies
- **Runtime**: Node.js
- **Language**: TypeScript (Strict Mode)
- **Framework**: Express.js
- **Websockets**: Socket.IO
- **Task Scheduling**: Interval-based Worker

### 🗄️ Database & Persistence
- **Primary Database**: MongoDB / SurrealDB
- **Transaction Context**: AsyncLocalStorage (Node.js native)
- **Schema Strategy**: Mixed (Schemaless initialization with Indexing)

### 🚀 Real-time & Communication
- **Websocket Engine**: Socket.IO
- **Socket Scaling**: Redis Adapter (Pub/Sub)
- **Real-time Patterns**: Gateway, Room-based registry
- **External Integration**: Telegram Bot API

### ⚡ Caching & Performance
- **Caching Provider**: Redis
- **Session Management**: In-memory Map (Graceful disconnect) + Redis (Persistence)
- **Message Optimization**: Optimistic UI (FE) + Redis Cache (BE)

### 📩 Messaging & Events
- **Event Bus**: In-process EventBus (Pub/Sub)
- **Message Consistency**: Outbox Worker (Polling & Dispatching)
- **Notification System**: Observer Pattern (Socket/Telegram Notifiers)

### 📂 Storage & Infrastructure
- **File Storage**: Google Drive API
- **Error Handling**: Centralized Middleware + Domain Errors
- **Configuration**: Environment Variables (.env)

### 🛠️ Cross-cutting Concerns
- **Security**: Helmet, CORS, JWT-based Socket Auth
- **Utility**: MS (Time parsing), UUID v4
- **Compression**: Gzip/Brotli (Compression middleware)
- **Logging**: Morgan (HTTP), Custom Gateway Logger

### 🔄 Data Flow
1. **Write**: Controller -> Application Service -> **Unit of Work** (Repo + Outbox) -> DB.
2. **Async**: Outbox Worker -> EventBus -> Handlers (Socket/Telegram Notifiers).
3. **Read**: Controller -> Application Service -> Redis Cache / Repo -> UI.
export interface MessageTemplate {
  title: string;
  description: string;
  template: (data?: Record<string, string | number>) => string;
  parseMode?: "HTML" | "MarkdownV2";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatJson(value: unknown): string {
  return escapeHtml(JSON.stringify(value, null, 2));
}

export const telegramTemplates: Record<string, MessageTemplate> = {
  simple: {
    title: "Simple Test",
    description: "Một tin nhắn test đơn giản",
    parseMode: "HTML",
    template: () => `✅ <b>Test message from Chat-Community</b>\n🕐 ${escapeHtml(new Date().toLocaleString("vi-VN"))}`,
  },

  adminOffline: {
    title: "Admin Offline",
    description: "Thông báo admin offline nhận tin nhắn mới",
    parseMode: "HTML",
    template: (data = {}) => {
      const sender = escapeHtml(String(data.sender || "Unknown User"));
      const receiver = escapeHtml(String(data.receiver || "Unknown"));
      const content = escapeHtml(String(data.content ?? "<no content>"));
      const createdAt = escapeHtml(String(data.createdAt || new Date().toISOString()));
      const extra = {
        sender: data.sender ?? "Unknown User",
        receiver: data.receiver ?? "Unknown",
        content: data.content ?? "<no content>",
        createdAt: data.createdAt ?? new Date().toISOString(),
      };

      return `📩 <b>New Message Alert</b>\n\n👤 From: ${sender}\n💬 Message: ${content}\n🕐 Time: ${createdAt}\n\n<b>Payload</b>:\n<pre>${formatJson(extra)}</pre>`;
    },
  },

  userJoined: {
    title: "User Joined",
    description: "Thông báo có user mới join room",
    parseMode: "HTML",
    template: (data = {}) => {
      const username = escapeHtml(String(data.username || "New User"));
      const room = escapeHtml(String(data.room || "General"));
      const totalUsers = escapeHtml(String(data.totalUsers ?? 1));

      return `👋 <b>New User Joined</b>\n\n✨ User: ${username}\n🏠 Room: ${room}\n👥 Total: ${totalUsers} users`;
    },
  },

  errorNotification: {
    title: "Error Alert",
    description: "Thông báo lỗi hệ thống",
    parseMode: "HTML",
    template: (data = {}) => {
      const error = escapeHtml(String(data.error || "Unknown Error"));
      const component = escapeHtml(String(data.component || "System"));
      const severity = escapeHtml(String(data.severity || "Medium"));
      const context = escapeHtml(String(data.context || "N/A"));

      const extra = {
        component: data.component ?? "System",
        error: data.error ?? "Unknown Error",
        severity: data.severity ?? "Medium",
        context: data.context ?? "N/A",
      };

      return `🔴 <b>Error Alert</b>\n\n⚙️ Component: ${component}\n❌ Error: ${error}\n📊 Severity: ${severity}\n\n<b>Error body</b>:\n<pre>${formatJson(extra)}</pre>`;
    },
  },

  userBotMessageInfo: {
    title: "User Bot Message",
    description: "Thông báo khi user nhắn cho bot Telegram",
    parseMode: "HTML",
    template: (data = {}) => {
      const username = escapeHtml(String(data.username || "Unknown"));
      const userId = escapeHtml(String(data.userId || "Unknown"));
      const message = escapeHtml(String(data.message || "<no text>"));

      return `📩 <b>User Bot Message</b>\n\n👤 User: ${username}\n🆔 ID: <span class=\"tg-spoiler\">${userId}</span>\n💬 Message: ${message}`;
    },
  },

  serverStatus: {
    title: "Server Status",
    description: "Báo cáo trạng thái server",
    parseMode: "HTML",
    template: (data = {}) => {
      const status = escapeHtml(String(data.status || "Online"));
      const uptime = escapeHtml(String(data.uptime || "24h"));
      const users = escapeHtml(String(data.users ?? 0));
      const messages = escapeHtml(String(data.messages ?? 0));

      return `🟢 <b>Server Status</b>\n\n✅ Status: ${status}\n⏱️ Uptime: ${uptime}\n👥 Active Users: ${users}\n💬 Messages: ${messages}`;
    },
  },

  welcomeMessage: {
    title: "Welcome",
    description: "Chào mừng user mới",
    parseMode: "HTML",
    template: (data = {}) => {
      const name = escapeHtml(String(data.name || "User"));
      const feature = escapeHtml(String(data.feature || "Chat"));

      return `🎉 <b>Welcome to Chat-Community</b> 🎉\n\n👋 Hello ${name}!\n✨ Enjoy ${feature} with us!\n📲 Happy chatting!`;
    },
  },

  dailyReport: {
    title: "Daily Report",
    description: "Báo cáo hàng ngày",
    parseMode: "HTML",
    template: (data = {}) => {
      const date = escapeHtml(String(data.date || new Date().toLocaleDateString("vi-VN")));
      const activeUsers = escapeHtml(String(data.activeUsers ?? 0));
      const totalMessages = escapeHtml(String(data.totalMessages ?? 0));
      const newUsers = escapeHtml(String(data.newUsers ?? 0));

      return `📊 <b>Daily Report - ${date}</b>\n\n📈 Metrics:\n  • Active Users: ${activeUsers}\n  • Total Messages: ${totalMessages}\n  • New Users: ${newUsers}\n\n✨ Have a productive day!`;
    },
  },

  maintenanceNotice: {
    title: "Maintenance Notice",
    description: "Thông báo bảo trì hệ thống",
    parseMode: "HTML",
    template: (data = {}) => {
      const startTime = escapeHtml(String(data.startTime || "10:00 PM"));
      const duration = escapeHtml(String(data.duration || "2 hours"));
      const reason = escapeHtml(String(data.reason || "System maintenance"));

      return `🔧 <b>Maintenance Notice</b>\n\n⚠️ Reason: ${reason}\n🕐 Start: ${startTime}\n⏱️ Duration: ${duration}\n\n🙏 Thank you for your patience!`;
    },
  },

  promotionAlert: {
    title: "Promotion Alert",
    description: "Thông báo khuyến mãi/sự kiện",
    parseMode: "HTML",
    template: (data = {}) => {
      const title = escapeHtml(String(data.title || "Special Offer"));
      const description = escapeHtml(String(data.description || "Limited time"));
      const link = escapeHtml(String(data.link || "https://chat-community.com"));

      return `🎁 <b>${title}</b> 🎁\n\n🌟 ${description}\n🔗 Check it out: ${link}\n\n⚡ Don't miss out!`;
    },
  },
};

export function getTemplate(name: string, data?: Record<string, string | number>) {
  const template = telegramTemplates[name];
  if (!template) {
    throw new Error(`Template "${name}" not found. Available: ${Object.keys(telegramTemplates).join(", ")}`);
  }
  return {
    text: template.template(data),
    parseMode: template.parseMode ?? "HTML",
  };
}

export function listTemplates(): void {
  console.log("\n📋 Available Telegram Message Templates:\n");
  Object.entries(telegramTemplates).forEach(([key, value]) => {
    console.log(`  ${key.padEnd(20)} - ${value.description}`);
  });
  console.log();
}

export type AppConfig = {
  prefix: string;
};

export function getAppConfig(): AppConfig {
  return {
    prefix: process.env.APP_NAME as string | "chat-community",
  };
}

export type AppConfig = {
  prefix: string;
};

export function getAppConfig(): AppConfig {
  return {
    prefix: process.env.APPNAME as string | "chat-community",
  };
}

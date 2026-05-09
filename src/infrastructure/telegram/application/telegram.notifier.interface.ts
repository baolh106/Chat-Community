export interface ITelegramNotifier {
  sendMessage(
    text: string,
    options?: {
      parseMode?: "HTML" | "MarkdownV2";
    },
  ): Promise<void>;
}

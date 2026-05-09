export interface ITelegramNotifier {
  sendMessage(
    text: string,
    options?: {
      parseMode?: "HTML" | "MarkdownV2";
    },
  ): Promise<void>;

  sendPoll(
    roomId: string,
    question: string,
    options: string[],
    config?: {
      allowMultiple?: boolean;
      isAnonymous?: boolean;
      explanation?: string;
    },
  ): Promise<void>;
}

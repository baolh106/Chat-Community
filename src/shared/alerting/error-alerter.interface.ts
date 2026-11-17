export type ErrorAlert = {
  message: string;
  statusCode: number;
  component: string;
  context: string;
};

export interface IErrorAlerter {
  alert(alert: ErrorAlert): void;
}

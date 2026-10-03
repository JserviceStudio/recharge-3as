export type TransactionStatus = 
  | "pending" 
  | "awaiting_payment" 
  | "paid" 
  | "crediting" 
  | "validated" 
  | "failed_credit" 
  | "rejected";

export type TransactionType = "recharge" | "withdrawal";

export interface DepositRequestPayload {
  userId: string;
  id1xbet: string;
  amount: number;
  paymentMethodId: string;
  paymentMethodLabel: string;
  userPhone: string;
}

export interface AggregatorWebhookPayload {
  reference: string;
  status: "successful" | "failed" | "pending";
  amount: number;
  rawPayload?: unknown;
}

export interface TransferRow {
  id: string;
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  amountSent: string;
  amountReceived: string;
  occurredAt: string; // ISO
  note: string | null;
}
export type NewTransfer = Omit<TransferRow, 'id' | 'userId'>;
export type TransferPatch = Partial<Omit<NewTransfer, 'fromAccountId' | 'toAccountId'>>;

export interface TransferRepository {
  list(userId: string, limit: number, before?: string, accountId?: string): Promise<TransferRow[]>;
  findById(userId: string, id: string): Promise<TransferRow | null>;
  insert(userId: string, data: NewTransfer): Promise<TransferRow>;
  update(userId: string, id: string, patch: TransferPatch): Promise<TransferRow | null>;
  delete(userId: string, id: string): Promise<boolean>;
  countByAccount(userId: string, accountId: string): Promise<number>;
}

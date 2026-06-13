export interface Transaction {
  id: number;
  userId: number;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed";
  createdAt: Date;
  updatedAt: Date;
}


export class TransactionModel {
  static tableName = "transactions";

  static getCreateTableSQL(): string {
    return `
      CREATE TABLE ${this.tableName} (
        id NUMBER PRIMARY KEY,
        user_id NUMBER NOT NULL,
        amount NUMBER(12,2) NOT NULL,
        currency VARCHAR2(3) NOT NULL,
        status VARCHAR2(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;
  }

  static getSequenceSQL(): string {
    return `
      CREATE SEQUENCE ${this.tableName}_seq
      START WITH 1
      INCREMENT BY 1
      NOCYCLE
    `;
  }
}

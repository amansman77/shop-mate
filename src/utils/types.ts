import { z } from 'zod';

// 영수증 아이템 타입
export const ReceiptItem = z.object({
    name: z.string(),
    price: z.number(),
    quantity: z.number()
});

export type ReceiptItem = z.infer<typeof ReceiptItem>;

// 처리된 영수증 데이터 타입
export const ProcessedReceipt = z.object({
    rawText: z.string(),
    processedText: z.string(),
    storeName: z.string(),
    totalAmount: z.number(),
    items: z.array(ReceiptItem),
    date: z.string(),
    paymentMethod: z.string(),
    cardNumber: z.string(),
    vatAmount: z.number()
});

export type ProcessedReceipt = z.infer<typeof ProcessedReceipt>;

// 영수증 파서 인터페이스
export interface ReceiptParser {
    canParse(text: string): boolean;
    parse(text: string): ProcessedReceipt;
}

// 영수증 처리 에러 클래스
export class ReceiptProcessingError extends Error {
    constructor(message: string, public readonly details?: unknown) {
        super(message);
        this.name = 'ReceiptProcessingError';
    }
} 
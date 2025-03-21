import { ProcessedReceipt } from './types';
import { ReceiptParserFactory } from './parsers/receipt-parser-factory';

const parserFactory = new ReceiptParserFactory();

export function preprocessReceipt(text: string): ProcessedReceipt {
    const parser = parserFactory.getParser(text);
    return parser.parse(text);
}

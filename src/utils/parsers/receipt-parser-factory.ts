import { ReceiptParser, ReceiptProcessingError } from '../types';
import { EmartReceiptParser } from './emart-parser';
import { TradersReceiptParser } from './traders-parser';

export class ReceiptParserFactory {
    private parsers: ReceiptParser[] = [
        new EmartReceiptParser(),
        new TradersReceiptParser()
    ];

    getParser(text: string): ReceiptParser {
        const parser = this.parsers.find(p => p.canParse(text));
        if (!parser) {
            throw new ReceiptProcessingError('지원하지 않는 영수증 형식입니다.');
        }
        return parser;
    }
} 
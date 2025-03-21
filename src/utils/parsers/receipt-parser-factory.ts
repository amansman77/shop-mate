import { ReceiptParser, ReceiptProcessingError } from '../types';
import { EmartReceiptParser } from './emart-parser';

export class ReceiptParserFactory {
    private parsers: ReceiptParser[];

    constructor() {
        this.parsers = [
            new EmartReceiptParser()
        ];
    }

    getParser(text: string): ReceiptParser {
        const parser = this.parsers.find(p => p.canParse(text));
        if (!parser) {
            throw new ReceiptProcessingError('지원하지 않는 영수증 형식입니다.');
        }
        return parser;
    }
} 
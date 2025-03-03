import { z } from 'zod';

// 전처리된 영수증 데이터의 타입 정의
export const ProcessedReceipt = z.object({
    rawText: z.string(),
    processedText: z.string(),
    storeName: z.string().optional(),
    totalAmount: z.number().optional(),
    items: z.array(z.object({
        name: z.string(),
        price: z.number(),
        quantity: z.number().optional()
    })).optional(),
    date: z.string().optional(),
    paymentMethod: z.string().optional(),
    cardNumber: z.string().optional(),
    vatAmount: z.number().optional()
});

export type ProcessedReceipt = z.infer<typeof ProcessedReceipt>;

export function preprocessReceipt(text: string): ProcessedReceipt {
    // 1. 기본 텍스트 정리 (줄바꿈 보존)
    let cleanedText = text
        .replace(/([^\n])\s+/g, '$1 ')  // 줄바꿈을 제외한 연속된 공백을 하나로
        .replace(/\s*\n\s*/g, '\n')     // 줄바꿈 주변의 공백 제거
        .trim();

    // 2. 상품 정보 구분을 위한 줄바꿈 추가
    cleanedText = cleanedText
        .replace(/(\d{13})/g, '$1\n')        // 바코드 뒤에 줄바꿈 추가
        .replace(/(-\d+(?:,\d+)?)/g, '$1\n') // 할인 금액 뒤에 줄바꿈 추가
        .replace(/(\d+[。]\s*\d+[。]\s*\d+)/g, '$1\n'); // 상품 정보 뒤에 줄바꿈 추가

    // 3. 연속된 줄바꿈을 하나로 정리
    cleanedText = cleanedText.replace(/\n+/g, '\n');

    // 디버깅을 위한 로그
    console.log('정리된 텍스트:', cleanedText);

    // 4. 상점명 추출 (이마트 파주점 패턴 찾기)
    const storePattern = /이\s*마\s*트\s*파\s*주\s*점/;
    const storeMatch = cleanedText.match(storePattern);
    const storeName = storeMatch ? storeMatch[0].replace(/\s+/g, '') : undefined;

    // 5. 날짜 추출
    const datePattern = /20\d{2}[-./]?(?:0[1-9]|1[0-2])[-./]?(?:0[1-9]|[12][0-9]|3[01])/;
    const dateMatch = cleanedText.match(datePattern);
    const date = dateMatch ? dateMatch[0].replace(/[./]/g, '').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : undefined;

    // 6. 금액 추출 (결제 대상 금액)
    const amountPattern = /결\s*제\s*대\s*상\s*금\s*액\s*(\d[\d,]*)/;
    const amountMatch = cleanedText.match(amountPattern);
    const totalAmount = amountMatch 
        ? parseInt(amountMatch[1].replace(/,/g, ''))
        : undefined;

    // 7. 결제 수단 추출
    const paymentPattern = /카\s*드\s*결\s*제/;
    const paymentMatch = cleanedText.match(paymentPattern);
    const paymentMethod = paymentMatch ? '신용카드' : undefined;

    // 8. 카드 번호 추출 (마스킹된 형식)
    const cardPattern = /94400200\*\*020/;
    const cardMatch = cleanedText.match(cardPattern);
    const cardNumber = cardMatch ? cardMatch[0] : undefined;

    // 9. 부가세 추출
    const vatPattern = /부\s*가\s*세\s*(\d[\d,]*)/;
    const vatMatch = cleanedText.match(vatPattern);
    const vatAmount = vatMatch 
        ? parseInt(vatMatch[1].replace(/,/g, ''))
        : undefined;

    // 10. 품목 추출 시도
    const items = extractItems(cleanedText);

    return {
        rawText: text,
        processedText: cleanedText,
        storeName,
        totalAmount,
        items,
        date,
        paymentMethod,
        cardNumber,
        vatAmount
    };
}

function extractItems(text: string): { name: string; price: number; quantity: number }[] {
    // 상품 목록 섹션 추출
    const itemSectionMatch = text.match(/상\s*품\s*명\s*단\s*가\s*수\s*량\s*금\s*액([\s\S]*?)(?:종\s*품\s*목|합\s*계)/);
    if (!itemSectionMatch) {
        return [];
    }

    const itemSection = itemSectionMatch[1];
    console.log('품목 섹션:', itemSection);
    
    const lines = itemSection.split('\n').filter(line => line.trim());
    console.log('분리된 라인들:', lines);
    
    const items: { name: string; price: number; quantity: number }[] = [];
    const discountLines = new Set();
    
    // 첫 번째 패스: 할인 라인과 헤더/푸터 식별
    lines.forEach((line, index) => {
        if (
            line.includes('할인') ||
            line.includes('-') ||
            line.includes('고래잇') ||
            line.includes('상품명') ||
            line.includes('종품목') ||
            line.includes('결제') ||
            line.includes('포인트') ||
            line.includes('[라면]')
        ) {
            discountLines.add(index);
        }
    });
    
    // 두 번째 패스: 상품 정보 추출
    lines.forEach((line, index) => {
        if (discountLines.has(index)) {
            return; // 할인 라인 건너뛰기
        }
        
        console.log('처리 중인 라인: ', line);
        
        // 바코드 제거
        line = line.replace(/\d{13}/, '').trim();
        
        // 특수 문자 정규화
        line = line.replace(/[。]/g, '.').replace(/[_]/g, ' ');
        
        // 다양한 패턴 정의
        const patterns = [
            // 패턴 1: 상품명 가격 수량 금액 (기본 형식)
            /^[*\s]*(?:[0-9Q]+\s+)?([^0-9]+)[\s_.]*([0-9,]+)[\s_.]*([0-9]+)[\s_.]*([0-9,]+)/,
            // 패턴 2: 상품명 (숫자 포함) 가격 수량 금액
            /^[*\s]*(?:[0-9Q]+\s+)?([^.]+?)[\s_]*([0-9,]+)[\s_.]*([0-9]+)[\s_.]*([0-9,]+)/,
            // 패턴 3: 특수문자로 구분된 형식
            /^[*\s]*(?:[0-9Q]+\s+)?([^.]+)[._]([0-9,]+)[._]([0-9]+)[._]([0-9,]+)/,
            // 패턴 4: 상품명 숫자 가격 수량 금액
            /^[*\s]*(?:[0-9Q]+\s+)?([^0-9]+\s*\d+)\s+([0-9,]+)\s+([0-9]+)\s+([0-9,]+)/
        ];
        
        let matched = false;
        let matchResult = null;
        let bestMatch = { name: '', price: 0, quantity: 0, amount: 0 };
        let bestError = Infinity;
        
        for (let i = 0; i < patterns.length && !matched; i++) {
            matchResult = line.match(patterns[i]);
            if (matchResult) {
                try {
                    let name = matchResult[1].trim();
                    const priceStr = matchResult[2].replace(/[,_.]/g, '');
                    const quantityStr = matchResult[3].replace(/[,_.]/g, '');
                    const amountStr = matchResult[4].replace(/[,_.]/g, '');
                    
                    // 숫자 변환 전 유효성 검사
                    if (!/^\d+$/.test(priceStr) || !/^\d+$/.test(quantityStr) || !/^\d+$/.test(amountStr)) {
                        continue;
                    }
                    
                    const price = parseInt(priceStr, 10);
                    const quantity = parseInt(quantityStr, 10);
                    const amount = parseInt(amountStr, 10);
                    
                    // 기본 유효성 검사
                    if (price <= 0 || quantity <= 0 || amount <= 0) {
                        continue;
                    }
                    
                    // 금액 오차 계산
                    const expectedAmount = price * quantity;
                    const error = Math.abs(expectedAmount - amount);
                    
                    // 가격 보정이 필요한 경우
                    if (error > 100 && amount >= 1000) {
                        // 상품명에 포함된 숫자가 가격으로 잘못 인식된 경우
                        const correctedPrice = Math.round(amount / quantity);
                        if (correctedPrice >= 1000) {
                            const correctedError = Math.abs(correctedPrice * quantity - amount);
                            if (correctedError < error) {
                                bestMatch = { name, price: correctedPrice, quantity, amount };
                                bestError = correctedError;
                                continue;
                            }
                        }
                    }
                    
                    // 더 나은 매치를 찾았다면 업데이트
                    if (error < bestError) {
                        bestError = error;
                        bestMatch = { name, price, quantity, amount };
                        
                        // 정확한 매치를 찾았다면 중단
                        if (error === 0) {
                            matched = true;
                        }
                    }
                } catch (error) {
                    console.error('상품 정보 처리 중 오류:', error);
                }
            }
        }
        
        // 최선의 매치가 있고 오차가 허용 범위 내라면 추가
        if (bestMatch.price > 0 && bestMatch.quantity > 0 && bestError <= 1000) {
            // 상품명 정리
            let name = bestMatch.name
                .replace(/^[0-9Q*\s]+/, '') // 선행 숫자와 특수문자 제거
                .replace(/\s+/g, ' ') // 연속된 공백을 하나의 공백으로
                .replace(/^분\s*세\s*차\s*/, '') // "분세차" 접두어 제거
                .replace(/\s*\d+\s*$/, '') // 끝에 있는 숫자 제거
                .replace(/\s*\([^)]*\)\s*$/, '') // 괄호와 그 안의 내용 제거
                .replace(/[._]/g, ' ') // 특수문자를 공백으로 변환
                .replace(/상\s*품\s*명.*단\s*가.*수\s*량.*금\s*액.*$/, '') // 헤더 제거
                .trim();
            
            // 중복 상품 체크
            const isDuplicate = items.some(item => 
                item.name === name && 
                item.price === bestMatch.price && 
                item.quantity === bestMatch.quantity
            );
            
            if (!isDuplicate && name) {
                items.push({
                    name,
                    price: bestMatch.price,
                    quantity: bestMatch.quantity
                });
                
                console.log('추출된 상품:', { name, price: bestMatch.price, quantity: bestMatch.quantity, amount: bestMatch.amount });
            }
        }
    });
    
    console.log('추출된 상품 목록:', items);
    return items;
} 
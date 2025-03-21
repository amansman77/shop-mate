import { preprocessReceipt } from './receipt-processor';

describe('영수증 전처리 테스트', () => {
    const sampleReceipts = {
        emart: `
11:31008@0 ㆍ 실 =6.89 | 2896 를 ㅡ 갑 모 바 일 영 수 증 = emart ;) . 빠 른 환 불 접 수 20250302100645820007692021 이 마 트 파 주 점 7:(031)950-1234 206-86-50913 한 채 양 경 기 도 파 주 시 당 하 길 10 영 수 증 미 지 참 시 교 환 / 환 불 불 가 정 상 상 품 에 한 함 , 30 일 이 내 ( 신 선 7 일 ) ※ 일 부 브 랜 드 매 장 제 외 ( 매 장 고 지 물 참 조 ) 교 환 / 환 불 구 매 점 에 서 가 능 ( 결 제 카드 지 참 ) [ 구 매 ]2025-03-02 18:38 POS : 1006-4582 상 품 명 단 가 수 량 금 액 3 분 세 차 리 치 버 블 카 샴 _ 9,800。 1 。 9,800 8807424243936 3월 고 래 잇 가 격 할 인 -4,900 * 한 수 위 파 주 쌀 ( 참 드림 _34,900_ 1 34,900 8809323257915 * 청 정 원 찰 고 추 장 29 33,000 1 33,000 8801052971131 고 래 잇 고 된 쌈 전 품 목 -16,500 Q 햇 반 불 고 기 주 먹 밥 8,980 1 8,980 8801007828282 냉 동 고 래 잇 -4,490 농 심 짜 파 게 티 더 블 530 2 10,600 8801043010016 [ 라 면 ] 3 개 8,700 원 -5,040 0 햇 반 버 터 장 조 림 주 8,980 1 8,980 8801007856391 냉 동 고 래 잇 -4,490 * 샘 표 쌈 토 장 4500 5,880 1 5,880 8801005139762 고 래 잇 고 된 쌈 전 품 목 -2,940 오 뚜 기 옛 날 잡 채 759 5,980 1 5,980 8801045480572 [ 라 면 ] 3 개 8,700 원 -2,840 종 품 목 수 량 8 (*) 면 세 물 품 54,340 과 세 물 품 20,527 부 가 세 2,053 합 계 76,920 직 원 할 인 -5,970 결 제 대 상 금 액 70,950 0011 BC 94400200**020*/46978745 카 드 결 제 (1() 일 시 불 / 70,950 [ 신 세 계 포 인트 적 립 ] 황 * 성 고 객 님 의 포 인트 현 황 입 니 다 . 금 회 발 생 포 인트 T9350%*128% 70 누 계 ( 가 용 ) 포 인트 8,724( 8,654) 익 월 1 일 소 멸 예 정 포 인트 145 * 신 세 계 포 인트 유 효 기 간 은 2 년 입 니 다 . 캐 셔 :063201 장 00 1040 20250302100645820007692021 빠 른 환 불 서 비 스 로 매 장 방 문 없 이 빠 르 고 간 편 하 게 환 불 받 으 세 요 ! 점 포 대 표 전 화 및 O|0IEY 영 수 증 ' 빠 른 환 불 접 수 ' 로 신 청 할 부 거래 계 약 서 약 관 보 기 > - 영 수 증 미 지 참 시 교 환 / 환 불 불 가 (30 일 내 ) - 교 환 / 환 불 구 매 점 에 서 가 능 ( 결 제 카드 지 참 ). - 체 크 카 드 취 소 시 대 금 환 급 은 최 대 7 일 소 요
        `
    };

    test('이마트 영수증 전처리', () => {
        const result = preprocessReceipt(sampleReceipts.emart);
        
        // 기본 정보 검증
        expect(result.storeName).toBe('이마트파주점');
        expect(result.date).toBe('2025-03-02');
        expect(result.totalAmount).toBe(70950);
        expect(result.vatAmount).toBe(2053);
        expect(result.paymentMethod).toBe('신용카드');
        expect(result.cardNumber).toBe('94400200**020');

        // 상품 목록 검증
        expect(result.items).toBeDefined();
        expect(result.items.length).toBeGreaterThanOrEqual(8);

        // 특정 상품 검증
        const targetItem = result.items.find(item => 
            item.name === '리치버블카샴' &&
            item.price === 9800 &&
            item.quantity === 1
        );
        expect(targetItem).toBeDefined();

        // 결과 출력
        console.log('\n=== 전처리 결과 ===\n');
        console.log('기본 정보:');
        console.log('- 상점명:', result.storeName);
        console.log('- 날짜:', result.date);
        console.log('- 총액:', result.totalAmount?.toLocaleString(), '원');
        console.log('- 부가세:', result.vatAmount?.toLocaleString(), '원');
        console.log('- 결제수단:', result.paymentMethod);
        console.log('- 카드번호:', result.cardNumber);
        
        console.log('\n상품 목록:');
        result.items.forEach(item => {
            console.log(`- ${item.name}: ${item.price.toLocaleString()}원 ${item.quantity ? `(${item.quantity}개)` : ''}`);
        });
    });
}); 
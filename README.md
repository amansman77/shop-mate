# Shop Mate - 영수증 관리 시스템

Shop Mate는 영수증 이미지를 업로드하고 OCR을 통해 텍스트를 추출하여 구조화된 데이터로 저장하고 관리하는 시스템입니다.

## 주요 기능

### 1. 영수증 이미지 처리
- 이미지 업로드 및 R2 스토리지 저장
- Tesseract.js를 사용한 OCR 텍스트 추출
- 추출된 텍스트 데이터 전처리 및 구조화

### 2. 데이터 저장
- 영수증 기본 정보
  - 상점명
  - 날짜
  - 총액
  - 부가세
  - 결제 수단
  - 카드 번호
- 상품 정보
  - 상품명
  - 단가
  - 수량
  - 금액

### 3. 영수증 조회 및 검색
- 전체 영수증 목록 조회
- 상점명, 날짜 기반 검색
- 상품명 기반 검색
- 상세 정보 조회 (상품 목록 포함)

## 기술 스택

- Frontend: HTML, TailwindCSS, JavaScript
- Backend: Cloudflare Workers (TypeScript)
- Storage:
  - Cloudflare R2: 이미지 저장
  - Cloudflare D1: 데이터베이스
- OCR: Tesseract.js

## 프로젝트 구조

```
shop-mate/
├── src/
│   ├── index.ts              # 메인 애플리케이션 로직
│   └── utils/
│       └── receipt-processor.ts  # 영수증 처리 로직
├── public/
│   └── index.html           # 프론트엔드 UI
└── schema.sql              # 데이터베이스 스키마
```

## 데이터베이스 스키마

### receipts 테이블
- `id`: 기본 키
- `image_id`: 이미지 파일 식별자
- `ocr_text`: OCR로 추출된 원본 텍스트
- `processed_data`: 전처리된 데이터 (JSON)
- `store_name`: 상점명
- `total_amount`: 총액
- `receipt_date`: 영수증 날짜
- `payment_method`: 결제 수단
- `card_number`: 카드 번호
- `vat_amount`: 부가세
- `created_at`: 생성 일시

### receipt_items 테이블
- `id`: 기본 키
- `receipt_id`: 영수증 참조 (외래 키)
- `name`: 상품명
- `price`: 단가
- `quantity`: 수량
- `amount`: 금액
- `created_at`: 생성 일시

## 설치 및 실행

1. 저장소 클론
```bash
git clone <repository-url>
cd shop-mate
```

2. 의존성 설치
```bash
npm install
```

3. 환경 설정
- Cloudflare 계정 설정
- R2 버킷 생성
- D1 데이터베이스 생성 및 스키마 적용

4. 개발 서버 실행
```bash
npm run dev
```

5. 배포
```bash
npm run deploy
```

## API 엔드포인트

### POST /api/images/upload
- 영수증 이미지 업로드
- multipart/form-data 형식
- 응답: 이미지 ID

### POST /api/receipts
- OCR 결과 저장
- Request Body: { imageId, ocrText }
- 응답: 처리된 영수증 데이터

### GET /api/receipts
- 영수증 목록 조회
- 응답: 영수증 목록

### GET /api/receipts/search
- 영수증 검색
- Query Parameter: q (검색어)
- 응답: 검색된 영수증 목록

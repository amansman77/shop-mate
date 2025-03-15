# Shop Mate - 영수증 관리 시스템

Shop Mate는 영수증 이미지를 업로드하고 OCR을 통해 텍스트를 추출하여 구조화된 데이터로 저장하고 관리하는 시스템입니다.

## 서비스 지향점

### 1. 개인정보 보호 중심 설계
- 카드 번호, VAT 정보 등 민감한 정보는 UI에서 표시하지 않음
- 디바이스 기반의 안전한 사용자 식별 시스템 구현
- 각 사용자는 자신의 영수증만 접근 가능

### 2. 사용자 경험 최적화
- 직관적인 드래그 앤 드롭 이미지 업로드
- 실시간 OCR 처리 상태 표시
- 깔끔한 영수증 목록 UI와 상세 정보 토글
- 효율적인 검색 기능 제공

### 3. 디바이스 독립적 설계
- 브라우저 기반으로 설치 없이 즉시 사용 가능
- 반응형 디자인으로 모든 디바이스 지원
- 로컬 스토리지를 활용한 디바이스 식별 정보 유지

### 4. 보안 및 신뢰성
- 고유한 디바이스 지문을 통한 사용자 식별
  - CPU, 메모리, GPU 정보
  - 화면 해상도 및 색상 심도
  - 시스템 설정 (언어, 타임존 등)
  - 하드웨어 성능 지표
- SHA-256 해시 기반의 안전한 디바이스 ID 생성
- 데이터 접근 제어를 통한 프라이버시 보호

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
- `device_id`: 디바이스 식별자 (사용자 구분용)
- `image_id`: 이미지 파일 식별자
- `ocr_text`: OCR로 추출된 원본 텍스트
- `processed_data`: 전처리된 데이터 (JSON)
- `store_name`: 상점명
- `total_amount`: 총액
- `receipt_date`: 영수증 날짜
- `payment_method`: 결제 수단
- `card_number`: 카드 번호 (저장용, UI 비표시)
- `vat_amount`: 부가세 (저장용, UI 비표시)
- `created_at`: 생성 일시

### receipt_items 테이블
- `id`: 기본 키
- `receipt_id`: 영수증 참조 (외래 키)
- `name`: 상품명
- `price`: 단가
- `quantity`: 수량
- `amount`: 금액
- `created_at`: 생성 일시

### 인덱스
- `idx_receipts_device_id`: 디바이스별 영수증 조회 최적화
- `idx_receipts_store_name`: 상점명 기반 검색 최적화
- `idx_receipts_date`: 날짜 기반 검색 최적화
- `idx_receipt_items_name`: 상품명 기반 검색 최적화

## API 엔드포인트

### POST /api/images/upload
- 영수증 이미지 업로드
- Request:
  - Method: POST
  - Content-Type: multipart/form-data
  - Body: { image: File }
- Response:
  - Success: { success: true, imageUrl: string }
  - Error: { error: string, details: string }

### POST /api/receipts
- OCR 결과 저장
- Request:
  - Method: POST
  - Content-Type: application/json
  - Body: { imageId: string, ocrText: string, deviceId: string }
- Response:
  - Success: { success: true, receiptId: number, processedData: object }
  - Error: { error: string, details: string }

### GET /api/receipts
- 영수증 목록 조회
- Request:
  - Method: GET
  - Query Parameters: deviceId (필수)
- Response:
  - Success: { success: true, receipts: Array<Receipt> }
  - Error: { error: string, details: string }

### GET /api/receipts/search
- 영수증 검색
- Request:
  - Method: GET
  - Query Parameters:
    - q: 검색어 (필수)
    - deviceId: 디바이스 식별자 (필수)
- Response:
  - Success: { success: true, receipts: Array<Receipt> }
  - Error: { error: string, details: string }

### DELETE /api/receipts/:id
- 영수증 삭제
- Request:
  - Method: DELETE
  - URL Parameters: id (영수증 ID)
  - Query Parameters: deviceId (필수)
- Response:
  - Success: { success: true, message: string }
  - Error: { error: string, details: string }

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

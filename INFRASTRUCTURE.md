# Shop Mate 인프라 구조

## 개요
Shop Mate는 Cloudflare Workers를 기반으로 구축된 서버리스 애플리케이션입니다. 영수증 이미지 업로드, OCR 처리, 데이터 저장 및 검색 기능을 제공합니다.

## 핵심 컴포넌트

### 1. Cloudflare Workers
- **역할**: 서버리스 컴퓨팅 플랫폼으로 API 엔드포인트 처리
- **주요 기능**:
  - 이미지 업로드 처리
  - OCR 결과 저장
  - 영수증 검색 및 조회
  - 정적 파일 서빙

### 2. Cloudflare D1 (SQLite)
- **역할**: 서버리스 SQLite 데이터베이스
- **주요 테이블**:
  - `receipts`: 영수증 기본 정보 저장
  - `receipt_items`: 영수증 상품 정보 저장
- **특징**:
  - 자동 백업
  - SQLite 호환성
  - 서버리스 운영

### 3. Cloudflare R2
- **역할**: 영수증 이미지 저장소
- **주요 기능**:
  - 이미지 파일 저장
  - 고유한 파일명 생성
  - 이미지 삭제 처리
- **특징**:
  - S3 호환 API
  - 글로벌 CDN
  - 비용 효율적 저장

## 보안

### 1. 환경 변수
- **DATABASE_ID**: D1 데이터베이스 식별자
- **BCRYPT_ROUNDS**: 비밀번호 암호화 강도 설정
- **R2_BUCKET_NAME**: R2 버킷 이름

### 2. 접근 제어
- CORS 설정으로 허용된 도메인만 API 접근 가능
- 디바이스 ID 기반 데이터 접근 제어
- 환경 변수를 통한 민감 정보 관리

## 배포 프로세스
1. 코드 변경사항 커밋
2. Wrangler CLI를 통한 배포
3. 자동 환경 변수 적용
4. 글로벌 CDN을 통한 즉시 배포

## 모니터링
- Cloudflare Workers 로그
- 데이터베이스 쿼리 로그
- 이미지 업로드/삭제 이벤트 로그

## 확장성
- 서버리스 아키텍처로 자동 스케일링
- 글로벌 CDN을 통한 지연 시간 최소화
- 데이터베이스 자동 백업 및 복구

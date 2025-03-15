DROP TABLE IF EXISTS receipt_items;
DROP TABLE IF EXISTS receipts;

CREATE TABLE receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,             -- 디바이스 식별자
    image_id TEXT NOT NULL,
    ocr_text TEXT NOT NULL,
    processed_data TEXT,
    store_name TEXT,
    total_amount INTEGER,
    receipt_date TEXT,
    payment_method TEXT,
    card_number TEXT,
    vat_amount INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 상품 정보를 저장하는 테이블
CREATE TABLE receipt_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id INTEGER NOT NULL,         -- receipts 테이블 참조
    name TEXT NOT NULL,                  -- 상품명
    price INTEGER NOT NULL,              -- 단가
    quantity INTEGER NOT NULL,           -- 수량
    amount INTEGER NOT NULL,             -- 금액 (단가 * 수량)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
);

-- 검색을 위한 인덱스
CREATE INDEX idx_receipts_device_id ON receipts(device_id);
CREATE INDEX idx_receipts_store_name ON receipts(store_name);
CREATE INDEX idx_receipts_date ON receipts(receipt_date);
CREATE INDEX idx_receipt_items_name ON receipt_items(name); 
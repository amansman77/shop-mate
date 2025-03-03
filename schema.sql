DROP TABLE IF EXISTS receipts;
CREATE TABLE receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
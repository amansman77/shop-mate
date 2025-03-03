/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { preprocessReceipt } from './utils/receipt-processor';

// Create a new Hono app
const app = new Hono();

// Enable CORS
app.use('*', cors());

// API routes
app.post('/api/images/upload', async (c) => {
  try {
    console.log('Starting image upload process...');
    
    const formData = await c.req.formData();
    const image = formData.get('image');

    console.log('Received form data:', {
      hasImage: !!image,
      imageType: image instanceof File ? image.type : typeof image,
    });

    if (!image) {
      return c.json({ 
        error: 'No image provided',
        details: 'The image field is missing in the form data'
      }, 400);
    }

    if (!(image instanceof File)) {
      return c.json({ 
        error: 'Invalid file type',
        details: `Expected File but got ${typeof image}`
      }, 400);
    }

    // Validate file type
    if (!image.type.startsWith('image/')) {
      return c.json({ 
        error: 'Invalid file type',
        details: `File type "${image.type}" is not supported. Only images are allowed.`
      }, 400);
    }

    // Get environment bindings
    const env = c.env as { SHOP_MATE_IMAGES: R2Bucket };
    
    if (!env.SHOP_MATE_IMAGES) {
      console.error('R2 bucket binding not found');
      return c.json({ 
        error: 'Storage configuration error',
        details: 'R2 bucket not properly configured',
        debug: { env: Object.keys(c.env) }
      }, 500);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}-${image.name}`;

    console.log('Preparing to upload:', {
      filename,
      size: image.size,
      type: image.type
    });

    try {
      // Convert file to ArrayBuffer
      const buffer = await image.arrayBuffer();
      console.log('File converted to ArrayBuffer:', {
        bufferSize: buffer.byteLength
      });

      // Upload to R2
      await env.SHOP_MATE_IMAGES.put(filename, buffer, {
        httpMetadata: { contentType: image.type },
      });

      console.log('Upload successful');

      return c.json({
        success: true,
        imageUrl: filename,
      });
    } catch (uploadError) {
      console.error('R2 upload error:', uploadError);
      return c.json({ 
        error: 'Failed to upload image to storage',
        details: uploadError instanceof Error ? uploadError.message : 'Unknown error',
        debug: {
          errorType: uploadError?.constructor?.name,
          errorMessage: uploadError instanceof Error ? uploadError.message : String(uploadError)
        }
      }, 500);
    }
  } catch (error) {
    console.error('Error processing upload:', error);
    return c.json({ 
      error: 'Failed to process image upload',
      details: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        errorType: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

app.post('/api/receipts', async (c) => {
  try {
    console.log('Starting OCR result save process...');
    
    const body = await c.req.json();
    console.log('Received OCR data:', body);

    const { imageId, ocrText } = body;

    if (!imageId || !ocrText) {
      console.log('Missing required fields:', { imageId, ocrText });
      return c.json({ 
        error: 'Missing required fields',
        details: 'Both imageId and ocrText are required'
      }, 400);
    }

    // Get environment bindings
    const env = c.env as { DB: D1Database };
    
    if (!env.DB) {
      console.error('D1 database binding not found');
      return c.json({ 
        error: 'Database configuration error',
        details: 'Database not properly configured',
        debug: { env: Object.keys(c.env) }
      }, 500);
    }

    // 전처리 수행
    const processedData = preprocessReceipt(ocrText);
    console.log('Preprocessed data:', processedData);

    // 트랜잭션 시작
    try {
      const result = await env.DB.batch([
        // 영수증 기본 정보 저장
        env.DB
          .prepare(`
            INSERT INTO receipts (
              image_id, 
              ocr_text, 
              processed_data,
              store_name,
              total_amount,
              receipt_date,
              payment_method,
              card_number,
              vat_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
          `)
          .bind(
            imageId,
            ocrText,
            JSON.stringify(processedData),
            processedData.storeName || null,
            processedData.totalAmount || null,
            processedData.date || null,
            processedData.paymentMethod || null,
            processedData.cardNumber || null,
            processedData.vatAmount || null
          )
      ]);

      const receiptId = result[0].results[0].id;
      console.log('Receipt saved with ID:', receiptId);

      // 상품 정보 저장
      if (processedData.items && processedData.items.length > 0) {
        console.log('Saving items:', processedData.items);
        const itemInserts = processedData.items.map(item => 
          env.DB
            .prepare(`
              INSERT INTO receipt_items (
                receipt_id,
                name,
                price,
                quantity,
                amount
              ) VALUES (?, ?, ?, ?, ?)
            `)
            .bind(
              receiptId,
              item.name,
              item.price,
              item.quantity || 1,
              (item.price * (item.quantity || 1))
            )
        );

        await env.DB.batch(itemInserts);
        console.log('Items saved successfully');
      }

      return c.json({
        success: true,
        receiptId,
        processedData
      });
    } catch (error) {
      console.error('Database error:', error);
      return c.json({ 
        error: 'Failed to save receipt data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  } catch (error) {
    console.error('Error saving OCR result:', error);
    return c.json({ 
      error: 'Failed to save OCR result',
      details: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        errorType: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

app.get('/api/receipts', async (c) => {
  try {
    console.log('Fetching receipts list...');

    // Get environment bindings
    const env = c.env as { DB: D1Database };
    
    if (!env.DB) {
      console.error('D1 database binding not found');
      return c.json({ 
        error: 'Database configuration error',
        details: 'Database not properly configured',
        debug: { env: Object.keys(c.env) }
      }, 500);
    }

    // Fetch receipts from database
    const result = await env.DB
      .prepare('SELECT * FROM receipts ORDER BY created_at DESC')
      .all();

    console.log('Receipts fetched successfully:', {
      count: result.results.length
    });

    return c.json({
      success: true,
      receipts: result.results
    });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    return c.json({ 
      error: 'Failed to fetch receipts',
      details: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        errorType: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

app.get('/api/receipts/search', async (c) => {
  try {
    console.log('Searching receipts...');
    const query = c.req.query('q');

    if (!query) {
      return c.json({ 
        error: 'Missing search query',
        details: 'Search query parameter "q" is required'
      }, 400);
    }

    // Get environment bindings
    const env = c.env as { DB: D1Database };
    
    if (!env.DB) {
      console.error('D1 database binding not found');
      return c.json({ 
        error: 'Database configuration error',
        details: 'Database not properly configured',
        debug: { env: Object.keys(c.env) }
      }, 500);
    }

    console.log('Searching with query:', query);

    // Search receipts in database with improved Korean text search
    const searchTerms = query.split('').join('%');
    const result = await env.DB
      .prepare(`
        SELECT * FROM receipts 
        WHERE ocr_text LIKE ? 
        OR ocr_text LIKE ? 
        ORDER BY 
          CASE 
            WHEN ocr_text LIKE ? THEN 1
            ELSE 2
          END,
          created_at DESC
      `)
      .bind(`%${query}%`, `%${searchTerms}%`, `%${query}%`)
      .all();

    console.log('Search completed:', {
      query,
      searchTerms,
      count: result.results.length
    });

    return c.json({
      success: true,
      receipts: result.results
    });
  } catch (error) {
    console.error('Error searching receipts:', error);
    return c.json({ 
      error: 'Failed to search receipts',
      details: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        errorType: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    }, 500);
  }
});

// Serve static files
app.get('*', async (c) => {
  const env = c.env as { ASSETS: { fetch: (req: Request) => Promise<Response> } };
  return env.ASSETS.fetch(c.req.raw);
});

export default app;

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

    const { imageId, ocrText, deviceId } = body;

    if (!imageId || !ocrText || !deviceId) {
      console.log('Missing required fields:', { imageId, ocrText, deviceId });
      return c.json({ 
        error: 'Missing required fields',
        details: 'imageId, ocrText, and deviceId are required'
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
              device_id,
              image_id, 
              ocr_text, 
              processed_data,
              store_name,
              total_amount,
              receipt_date,
              payment_method,
              card_number,
              vat_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
          `)
          .bind(
            deviceId,
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
    
    const deviceId = c.req.query('deviceId');
    
    if (!deviceId) {
      return c.json({ 
        error: 'Missing device ID',
        details: 'Device ID is required'
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

    // Fetch receipts from database
    const result = await env.DB
      .prepare(`
        SELECT 
          r.id,
          r.image_id,
          r.store_name,
          r.total_amount,
          r.receipt_date,
          r.created_at,
          json_group_array(
            json_object(
              'name', ri.name,
              'price', ri.price,
              'quantity', ri.quantity
            )
          ) as items
        FROM receipts r
        LEFT JOIN receipt_items ri ON r.id = ri.receipt_id
        WHERE r.device_id = ?
        GROUP BY r.id
        ORDER BY r.created_at DESC
      `)
      .bind(deviceId)
      .all();

    console.log('Receipts fetched successfully:', {
      count: result.results.length
    });

    // Process the results to format items properly
    const receipts = result.results.map(receipt => ({
      ...receipt,
      processed_data: JSON.stringify({
        items: JSON.parse(receipt.items).filter(item => item.name !== null)
      })
    }));

    return c.json({
      success: true,
      receipts
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
    const deviceId = c.req.query('deviceId');

    if (!query || !deviceId) {
      return c.json({ 
        error: 'Missing required parameters',
        details: 'Both search query (q) and device ID (deviceId) are required'
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
        SELECT 
          r.id,
          r.image_id,
          r.store_name,
          r.total_amount,
          r.receipt_date,
          r.created_at,
          json_group_array(
            json_object(
              'name', ri.name,
              'price', ri.price,
              'quantity', ri.quantity
            )
          ) as items
        FROM receipts r
        INNER JOIN receipt_items ri ON r.id = ri.receipt_id
        WHERE r.device_id = ?
        AND (ri.name LIKE ? OR ri.name LIKE ?)
        GROUP BY r.id
        ORDER BY r.created_at DESC
      `)
      .bind(
        deviceId,
        `%${query}%`,
        `%${searchTerms}%`
      )
      .all();

    console.log('Search completed:', {
      query,
      searchTerms,
      count: result.results.length
    });

    // Process the results to format items properly
    const receipts = result.results.map(receipt => ({
      ...receipt,
      processed_data: JSON.stringify({
        items: JSON.parse(receipt.items).filter(item => item.name !== null)
      })
    }));

    return c.json({
      success: true,
      receipts
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

app.delete('/api/receipts/:id', async (c) => {
  try {
    console.log('Starting receipt deletion process...');
    
    const receiptId = c.req.param('id');
    const deviceId = c.req.query('deviceId');
    
    if (!receiptId || !deviceId) {
      return c.json({ 
        error: 'Missing required parameters',
        details: 'Both receipt ID and device ID are required'
      }, 400);
    }

    // Get environment bindings
    const env = c.env as { DB: D1Database, SHOP_MATE_IMAGES: R2Bucket };
    
    if (!env.DB) {
      console.error('D1 database binding not found');
      return c.json({ 
        error: 'Database configuration error',
        details: 'Database not properly configured'
      }, 500);
    }

    // Start transaction
    try {
      // 1. Get receipt information first (to get image_id)
      const receipt = await env.DB
        .prepare('SELECT image_id FROM receipts WHERE id = ? AND device_id = ?')
        .bind(receiptId, deviceId)
        .first();

      if (!receipt) {
        return c.json({ 
          error: 'Receipt not found',
          details: `No receipt found with ID: ${receiptId} for this device`
        }, 404);
      }

      // 2. Delete associated items first (foreign key constraint)
      await env.DB
        .prepare('DELETE FROM receipt_items WHERE receipt_id = ?')
        .bind(receiptId)
        .run();

      // 3. Delete the receipt record
      await env.DB
        .prepare('DELETE FROM receipts WHERE id = ? AND device_id = ?')
        .bind(receiptId, deviceId)
        .run();

      // 4. Delete the image from R2 if it exists
      if (env.SHOP_MATE_IMAGES && receipt.image_id) {
        try {
          await env.SHOP_MATE_IMAGES.delete(receipt.image_id);
        } catch (imageError) {
          console.error('Failed to delete image from R2:', imageError);
          // We don't want to fail the whole operation if image deletion fails
        }
      }

      return c.json({
        success: true,
        message: 'Receipt and associated data deleted successfully'
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return c.json({ 
        error: 'Failed to delete receipt',
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, 500);
    }
  } catch (error) {
    console.error('Error deleting receipt:', error);
    return c.json({ 
      error: 'Failed to process deletion request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Serve static files
app.get('*', async (c) => {
  const env = c.env as { ASSETS: { fetch: (req: Request) => Promise<Response> } };
  return env.ASSETS.fetch(c.req.raw);
});

export default app;

import { Hono } from 'hono';
import { cors } from 'hono/cors';

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

// Serve static files
app.get('*', async (c) => {
  const env = c.env as { ASSETS: { fetch: (req: Request) => Promise<Response> } };
  return env.ASSETS.fetch(c.req.raw);
});

export default app;

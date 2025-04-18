const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https://drive.google.com", "https://*.googleusercontent.com"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));

// CORS setup
app.use(cors({
  origin: process.env.FRONTEND_URL, // Your frontend URL
  methods: ['GET', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  message: { success: false, message: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

app.use(express.json());

app.get('/', (req, res) => {
  return res.send('This is the home page');
});

// Validate input middleware (only level is required)
const validateInput = (req, res, next) => {
  const { level } = req.query;

  // Check if level exists
  if (!level) {
    return res.status(400).json({
      success: false,
      message: 'Level is required'
    });
  }

  // Validate level (only allowed values)
  const allowedLevels = ['UG', 'PG', 'PHD'];
  if (!allowedLevels.includes(level)) {
    return res.status(400).json({
      success: false,
      message: 'Level must be one of: UG, PG, PHD'
    });
  }

  next();
};

// Google Drive API configuration
let auth;
if (process.env.GOOGLE_CLOUD_PRIVATE_KEY) {
  // Use environment variables if available
  auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });
} else {
  // Fallback to credentials file if environment variables are not set
  auth = new google.auth.GoogleAuth({
    keyFile: './credentials.json',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
}

const drive = google.drive({ version: 'v3', auth });

// Cache for folder IDs to reduce API calls
const folderCache = {};

// Sanitize file name to prevent path traversal
const sanitizeFileName = (name) => {
  return name.replace(/[^a-zA-Z0-9]/g, '');
};

// Main endpoint to fetch images based on level only
app.get('/api/images', validateInput, async (req, res) => {
  try {
    const { level } = req.query;
    const sanitizedLevel = sanitizeFileName(level);

    // Set a timeout to prevent long-running queries
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 30000)
    );

    // Get images with timeout
    const imagesPromise = getLevelImages(sanitizedLevel);
    const images = await Promise.race([imagesPromise, timeoutPromise]);

    return res.json({
      success: true,
      level: sanitizedLevel,
      images
    });
  } catch (error) {
    console.error('Error fetching images:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving images'
    });
  }
});

// Image proxy endpoint with caching
app.get('/api/image/:imageId', async (req, res) => {
  try {
    const imageId = req.params.imageId;

    // Get the file metadata for proper headers
    const fileMetadata = await drive.files.get({
      fileId: imageId,
      fields: 'mimeType,name'
    });

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL);
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Set caching headers
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Content-Type', fileMetadata.data.mimeType);
    res.setHeader('Content-Disposition', `inline`);

    // Stream the file content
    const response = await drive.files.get({
      fileId: imageId,
      alt: 'media'
    }, {
      responseType: 'stream'
    });

    // Pipe the image data directly to the response
    response.data.pipe(res);
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(404).send('Image not found');
  }
});

// Function to fetch images from a given level folder
async function getLevelImages(level) {
  try {
    let imagesFolderId = folderCache['Images'];
    let levelFolderId = folderCache[`Images/${level}`];

    // Step 1: Find the "Images" root folder (if not cached)
    if (!imagesFolderId) {
      const rootResponse = await drive.files.list({
        q: "name='Images' and mimeType='application/vnd.google-apps.folder'",
        fields: 'files(id, name)'
      });

      if (!rootResponse.data.files.length) {
        throw new Error('Images folder not found');
      }

      imagesFolderId = rootResponse.data.files[0].id;
      folderCache['Images'] = imagesFolderId;
    }

    // Step 2: Find the level folder (UG, PG, PHD) if not cached
    if (!levelFolderId) {
      const levelResponse = await drive.files.list({
        q: `name='${level}' and mimeType='application/vnd.google-apps.folder' and '${imagesFolderId}' in parents`,
        fields: 'files(id, name)'
      });

      if (!levelResponse.data.files.length) {
        throw new Error(`${level} folder not found`);
      }

      levelFolderId = levelResponse.data.files[0].id;
      folderCache[`Images/${level}`] = levelFolderId;
    }

    // Step 3: Get all images from the level folder (images are directly inside the level folder)
    const imagesResponse = await drive.files.list({
      q: `'${levelFolderId}' in parents and mimeType contains 'image/'`,
      fields: 'files(id, name, mimeType)',
      spaces: 'drive',
    });

    const MAX_IMAGES = 10000;
    const limitedFiles = imagesResponse.data.files.slice(0, MAX_IMAGES);

    // Map files with proxy endpoint URL
    return limitedFiles.map(file => ({
      id: file.id,
      url: `/api/image/${file.id}`,
      type: file.mimeType
    }));

  } catch (error) {
    console.error("Google Drive error:", error);
    return [];
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong on the server'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Resource not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (error) => {
  console.error('Server failed to start:', error);
});

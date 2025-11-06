const express = require("express");
const router = express.Router();
const { uploadContextFile } = require("../controllers/contextController");
const upload = require("../middleware/uploadMiddleware");
const { protect, restrictTo } = require("../middleware/authMiddleware"); // ✅
const SSEHelper = require("../utils/sseHelper");
const logger = require("../utils/logger");

router.post(
  "/upload-file",
  protect,
  restrictTo("admin"),
  upload.single("file"),
  uploadContextFile
);

/**
 * POST /api/context/upload-file/stream
 * Streaming version of context file upload with real-time progress
 * Returns Server-Sent Events with upload progress and processing status
 */
router.post(
  "/upload-file/stream",
  protect,
  restrictTo("admin"),
  upload.single("file"),
  async (req, res) => {
    const clientId = `context-upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Initialize SSE connection
      SSEHelper.initializeSSE(res, clientId);
      
      logger.info(`[${clientId}] Starting streaming context file upload`, {
        filename: req.file?.originalname,
        size: req.file?.size,
        mimetype: req.file?.mimetype
      });

      // Send initial connection event
      SSEHelper.sendEvent(res, 'connected', {
        message: 'Context file upload stream started',
        filename: req.file?.originalname,
        size: req.file?.size
      });

      // Send file validation progress
      SSEHelper.sendEvent(res, 'progress', { 
        step: 'validation', 
        message: 'Validating file...' 
      });

      if (!req.file) {
        SSEHelper.sendEvent(res, 'error', { 
          message: 'No file provided',
          step: 'validation'
        });
        SSEHelper.closeConnection(res, clientId);
        return;
      }

      // Send file processing progress
      SSEHelper.sendEvent(res, 'progress', { 
        step: 'processing', 
        message: 'Processing file content...',
        filename: req.file.originalname,
        size: req.file.size
      });

      // Call the original upload function with streaming context
      const result = await uploadContextFile(req, res, true); // Pass streaming flag

      // Send processing complete event
      SSEHelper.sendEvent(res, 'progress', { 
        step: 'complete', 
        message: 'File processing completed successfully',
        filename: req.file.originalname
      });

      // Send final result
      SSEHelper.sendEvent(res, 'result', {
        success: true,
        message: 'File uploaded and processed successfully',
        filename: req.file.originalname,
        chunks: result?.chunks || 0,
        tokens: result?.tokens || 0
      });

      // Send completion event
      SSEHelper.sendEvent(res, 'complete', {
        filename: req.file.originalname,
        chunks: result?.chunks || 0,
        tokens: result?.tokens || 0
      });

      logger.info(`[${clientId}] Context file upload stream complete`, {
        filename: req.file.originalname,
        chunks: result?.chunks || 0,
        tokens: result?.tokens || 0
      });

      SSEHelper.closeConnection(res, clientId);

    } catch (err) {
      logger.error(`[${clientId}] Context file upload stream error:`, err);
      
      try {
        SSEHelper.sendEvent(res, 'error', {
          message: 'File upload failed',
          error: err.message,
          filename: req.file?.originalname
        });
        SSEHelper.closeConnection(res, clientId);
      } catch (sseError) {
        logger.error(`[${clientId}] Failed to send SSE error:`, sseError);
      }
    }
  }
);

module.exports = router;

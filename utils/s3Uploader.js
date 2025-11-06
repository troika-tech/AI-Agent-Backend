// utils/s3Uploader.js
// AWS S3 upload utility for conversation transcript PDFs

const AWS = require('aws-sdk');
const logger = require('./logger');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'troika-conversation-pdfs';

/**
 * Upload PDF buffer to S3
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {String} key - S3 object key
 * @returns {Promise<String|null>} - S3 URL or null if failed
 */
async function uploadToS3(pdfBuffer, key) {
  try {
    if (!Buffer.isBuffer(pdfBuffer)) {
      throw new Error('Invalid PDF buffer provided');
    }

    if (pdfBuffer.length === 0) {
      throw new Error('Empty PDF buffer provided');
    }

    logger.info(`📤 Uploading PDF to S3: ${key} (${pdfBuffer.length} bytes)`);

    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ContentDisposition: 'attachment',
      ServerSideEncryption: 'AES256',
      Metadata: {
        'generated-by': 'troika-chatbot',
        'generated-at': new Date().toISOString(),
        'file-type': 'conversation-transcript'
      }
    };

    const result = await s3.upload(uploadParams).promise();
    
    logger.info(`✅ PDF uploaded successfully to S3: ${result.Location}`);
    return result.Location;

  } catch (error) {
    logger.error('❌ S3 upload failed:', error.message);
    return null;
  }
}

/**
 * Delete PDF from S3 (cleanup)
 * @param {String} key - S3 object key
 * @returns {Promise<Boolean>} - Success status
 */
async function deleteFromS3(key) {
  try {
    const deleteParams = {
      Bucket: BUCKET_NAME,
      Key: key
    };

    await s3.deleteObject(deleteParams).promise();
    logger.info(`🗑️ PDF deleted from S3: ${key}`);
    return true;

  } catch (error) {
    logger.error('❌ S3 delete failed:', error.message);
    return false;
  }
}

/**
 * Check if S3 is accessible
 * @returns {Promise<Boolean>} - Accessibility status
 */
async function checkS3Access() {
  try {
    await s3.headBucket({ Bucket: BUCKET_NAME }).promise();
    logger.info(`✅ S3 bucket accessible: ${BUCKET_NAME}`);
    return true;
  } catch (error) {
    logger.error(`❌ S3 bucket not accessible: ${error.message}`);
    return false;
  }
}

/**
 * List PDFs in S3 bucket (for debugging)
 * @param {String} prefix - Key prefix to filter
 * @returns {Promise<Array>} - List of objects
 */
async function listPDFs(prefix = 'conversation-transcripts/') {
  try {
    const listParams = {
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: 100
    };

    const result = await s3.listObjectsV2(listParams).promise();
    return result.Contents || [];

  } catch (error) {
    logger.error('❌ S3 list failed:', error.message);
    return [];
  }
}

module.exports = {
  uploadToS3,
  deleteFromS3,
  checkS3Access,
  listPDFs
};

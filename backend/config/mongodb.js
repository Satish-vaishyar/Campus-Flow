const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

let client = null;
let db = null;
let documentsBucket = null;
let indoorMapsBucket = null;

/**
 * Initialize MongoDB connection
 * Uses GridFS for storing large files (documents, images)
 */
async function initMongoDB() {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
        const dbName = process.env.MONGODB_DB_NAME || 'campus_flow';

        console.log('🔗 Connecting to MongoDB Atlas...');

        client = new MongoClient(uri);
        await client.connect();

        db = client.db(dbName);

        // Create GridFS buckets for file storage
        documentsBucket = new GridFSBucket(db, { bucketName: 'documents' });
        indoorMapsBucket = new GridFSBucket(db, { bucketName: 'indoor_maps' });

        console.log('✅ MongoDB connected successfully');
        return db;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

/**
 * Get MongoDB database instance
 */
function getDB() {
    if (!db) {
        throw new Error('MongoDB not initialized. Call initMongoDB() first.');
    }
    return db;
}

/**
 * Upload a document to GridFS
 * @param {string} eventId - Event ID
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {string} filename - Original filename
 * @param {string} contentType - MIME type
 * @returns {Promise<{fileId: string, filename: string}>}
 */
async function uploadDocument(eventId, fileBuffer, filename, contentType) {
    return new Promise((resolve, reject) => {
        const uploadStream = documentsBucket.openUploadStream(filename, {
            metadata: {
                eventId,
                contentType,
                uploadedAt: new Date()
            }
        });

        uploadStream.on('error', reject);
        uploadStream.on('finish', () => {
            resolve({
                fileId: uploadStream.id.toString(),
                filename: filename
            });
        });

        uploadStream.end(fileBuffer);
    });
}

/**
 * Upload an indoor map image to GridFS
 * @param {string} eventId - Event ID
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {string} filename - Original filename
 * @param {string} contentType - MIME type
 * @returns {Promise<{fileId: string, filename: string}>}
 */
async function uploadIndoorMap(eventId, fileBuffer, filename, contentType) {
    return new Promise((resolve, reject) => {
        const uploadStream = indoorMapsBucket.openUploadStream(filename, {
            metadata: {
                eventId,
                contentType,
                uploadedAt: new Date()
            }
        });

        uploadStream.on('error', reject);
        uploadStream.on('finish', () => {
            resolve({
                fileId: uploadStream.id.toString(),
                filename: filename
            });
        });

        uploadStream.end(fileBuffer);
    });
}

/**
 * Get document file stream from GridFS
 * @param {string} fileId - GridFS file ID
 * @returns {ReadableStream}
 */
function getDocumentStream(fileId) {
    return documentsBucket.openDownloadStream(new ObjectId(fileId));
}

/**
 * Get indoor map file stream from GridFS
 * @param {string} fileId - GridFS file ID
 * @returns {ReadableStream}
 */
function getIndoorMapStream(fileId) {
    return indoorMapsBucket.openDownloadStream(new ObjectId(fileId));
}

/**
 * Delete a document from GridFS
 * @param {string} fileId - GridFS file ID
 */
async function deleteDocument(fileId) {
    await documentsBucket.delete(new ObjectId(fileId));
}

/**
 * Delete an indoor map from GridFS
 * @param {string} fileId - GridFS file ID
 */
async function deleteIndoorMap(fileId) {
    await indoorMapsBucket.delete(new ObjectId(fileId));
}

/**
 * Get file info from GridFS
 * @param {string} fileId - GridFS file ID
 * @param {string} bucketType - 'documents' or 'indoor_maps'
 */
async function getFileInfo(fileId, bucketType = 'documents') {
    const bucket = bucketType === 'documents' ? documentsBucket : indoorMapsBucket;
    const files = await bucket.find({ _id: new ObjectId(fileId) }).toArray();
    return files[0] || null;
}

/**
 * Close MongoDB connection
 */
async function closeMongoDB() {
    if (client) {
        await client.close();
        console.log('MongoDB connection closed');
    }
}

module.exports = {
    initMongoDB,
    getDB,
    uploadDocument,
    uploadIndoorMap,
    getDocumentStream,
    getIndoorMapStream,
    deleteDocument,
    deleteIndoorMap,
    getFileInfo,
    closeMongoDB,
    ObjectId
};

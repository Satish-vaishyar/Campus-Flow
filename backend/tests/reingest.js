const { admin, initializeFirebase } = require('../config/firebase');
const { initMongoDB, getDocumentStream } = require('../config/mongodb');
const { ingestDocument } = require('../services/ingestion');
const { COLLECTIONS } = require('../config/firestore-schema');

// Initialize services
initializeFirebase();

async function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

async function reingestDocuments(eventCode) {
    console.log(`🔄 Re-ingesting documents for event: ${eventCode}`);

    // Connect to MongoDB
    await initMongoDB();
    const db = admin.firestore();

    // 1. Find Event ID
    const eventsSnapshot = await db.collection(COLLECTIONS.EVENTS)
        .where('eventCode', '==', eventCode.toUpperCase())
        .limit(1)
        .get();

    if (eventsSnapshot.empty) {
        console.error('❌ Event not found');
        process.exit(1);
    }

    const eventDoc = eventsSnapshot.docs[0];
    const eventId = eventDoc.id;
    console.log(`✅ Found event: ${eventDoc.data().name}`);

    // 2. Find Unprocessed Documents
    const docsSnapshot = await db.collection(COLLECTIONS.EVENTS)
        .doc(eventId)
        .collection('documents')
        .where('processedAt', '==', null)
        .get();

    if (docsSnapshot.empty) {
        console.log('✅ All documents are already processed.');
        process.exit(0);
    }

    console.log(`found ${docsSnapshot.size} unprocessed documents.`);

    // 3. Process Each Document
    for (const doc of docsSnapshot.docs) {
        const data = doc.data();
        console.log(`\n📄 Processing: ${data.filename} (ID: ${doc.id})`);

        try {
            // Get file from MongoDB
            if (!data.mongoFileId) {
                console.error('   ❌ Missing mongoFileId, skipping.');
                continue;
            }

            console.log(`   ⬇️ Downloading from GridFS (File ID: ${data.mongoFileId})...`);
            const downloadStream = getDocumentStream(data.mongoFileId);
            const buffer = await streamToBuffer(downloadStream);
            console.log(`   ✅ Downloaded ${buffer.length} bytes.`);

            // Ingest
            console.log('   🧠 Generating embeddings and indexing...');
            const chunkCount = await ingestDocument(eventId, doc.id, buffer, data.filename);
            console.log(`   ✅ Successfully indexed ${chunkCount} chunks.`);

        } catch (error) {
            console.error(`   ❌ Failed to process: ${error.message}`);
            if (error.response) {
                console.error('   Details:', error.response.data);
            }
        }
    }

    console.log('\n✨ Re-ingestion complete.');
    process.exit(0);
}

const eventCode = process.argv[2] || 'HTXO9B';
reingestDocuments(eventCode);

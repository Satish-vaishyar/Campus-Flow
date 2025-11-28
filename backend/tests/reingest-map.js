const { admin, initializeFirebase } = require('../config/firebase');
const { initMongoDB, getIndoorMapStream, getFileInfo } = require('../config/mongodb');
const { ingestIndoorMap } = require('../services/ingestion');
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

async function reingestMap(eventCode) {
    console.log(`🗺️ Re-ingesting indoor map for event: ${eventCode}`);

    // Connect to MongoDB
    await initMongoDB();
    const db = admin.firestore();

    // 1. Find Event
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
    const data = eventDoc.data();

    if (!data.indoorMapFileId) {
        console.error('❌ No indoor map uploaded for this event.');
        process.exit(1);
    }

    console.log(`✅ Found event: ${data.name}`);
    console.log(`   Map File ID: ${data.indoorMapFileId}`);

    try {
        // 2. Get file info and content
        const fileInfo = await getFileInfo(data.indoorMapFileId, 'indoor_maps');
        if (!fileInfo) {
            throw new Error('File not found in GridFS');
        }

        console.log(`   ⬇️ Downloading map image (${fileInfo.length} bytes)...`);
        const downloadStream = getIndoorMapStream(data.indoorMapFileId);
        const buffer = await streamToBuffer(downloadStream);

        // 3. Ingest
        console.log('   🧠 Generating description and indexing...');
        await ingestIndoorMap(eventId, data.indoorMapFileId, buffer, fileInfo.metadata?.contentType || 'image/png');

    } catch (error) {
        console.error(`   ❌ Failed to process map: ${error.message}`);
        if (error.response) {
            console.error('   Details:', error.response.data);
        }
    }

    console.log('\n✨ Map re-ingestion complete.');
    process.exit(0);
}

const eventCode = process.argv[2] || 'HTXO9B';
reingestMap(eventCode);

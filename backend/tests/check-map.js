const { admin, initializeFirebase } = require('../config/firebase');
const { initMongoDB, getIndoorMapStream, getFileInfo } = require('../config/mongodb');
const { COLLECTIONS } = require('../config/firestore-schema');

// Initialize services
initializeFirebase();

async function checkIndoorMap(eventCode) {
    console.log(`🔍 Checking indoor map for event code: ${eventCode}`);
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
    const data = eventDoc.data();
    console.log(`✅ Found event: ${data.name}`);
    console.log(`   Indoor Map URL: ${data.indoorMapUrl || '❌ NONE'}`);
    console.log(`   Indoor Map File ID: ${data.indoorMapFileId || '❌ NONE'}`);

    if (!data.indoorMapFileId) {
        console.log('❌ No indoor map file ID found in event document.');
        process.exit(0);
    }

    // 2. Check GridFS
    try {
        const fileInfo = await getFileInfo(data.indoorMapFileId, 'indoor_maps');
        if (!fileInfo) {
            console.error('❌ File not found in GridFS (indoor_maps bucket)');
        } else {
            console.log('\n📄 GridFS File Info:');
            console.log(`   Filename: ${fileInfo.filename}`);
            console.log(`   Content Type: ${fileInfo.metadata?.contentType}`);
            console.log(`   Size: ${fileInfo.length} bytes`);
            console.log(`   Upload Date: ${fileInfo.uploadDate}`);
        }
    } catch (error) {
        console.error('❌ Error checking GridFS:', error.message);
    }

    process.exit(0);
}

const eventCode = process.argv[2] || 'HTXO9B';
checkIndoorMap(eventCode);

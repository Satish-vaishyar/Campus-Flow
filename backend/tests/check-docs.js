const { admin, initializeFirebase } = require('../config/firebase');
const { COLLECTIONS } = require('../config/firestore-schema');

// Initialize Firebase
initializeFirebase();

async function checkEventDocuments(eventCode) {
    console.log(`🔍 Checking documents for event code: ${eventCode}`);
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
    console.log(`✅ Found event: ${eventDoc.data().name} (ID: ${eventId})`);

    // 2. Check Documents Collection
    const docsSnapshot = await db.collection(COLLECTIONS.EVENTS)
        .doc(eventId)
        .collection('documents')
        .get();

    console.log(`\n📄 Found ${docsSnapshot.size} documents:`);

    if (docsSnapshot.empty) {
        console.log('   (No documents uploaded)');
    }

    docsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   - File: ${data.filename}`);
        console.log(`     ID: ${doc.id}`);
        console.log(`     Uploaded At: ${data.uploadedAt?.toDate()}`);
        console.log(`     Processed At: ${data.processedAt?.toDate() || '❌ NOT PROCESSED'}`);
        console.log(`     Chunk Count: ${data.chunkCount}`);
    });

    // 3. Check Chunks Collection
    const chunksSnapshot = await db.collection(COLLECTIONS.EVENTS)
        .doc(eventId)
        .collection('chunks')
        .get();

    console.log(`\n🧩 Total Chunks in DB: ${chunksSnapshot.size}`);

    if (chunksSnapshot.size > 0) {
        const firstChunk = chunksSnapshot.docs[0].data();
        console.log('   Sample Chunk:', firstChunk.text.substring(0, 50) + '...');
        console.log('   Embedding Length:', firstChunk.embedding?.length);
    }

    process.exit(0);
}

const eventCode = process.argv[2] || 'HTXO9B';
checkEventDocuments(eventCode);

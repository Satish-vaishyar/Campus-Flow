require('dotenv').config();
const { answerQuestion } = require('../services/retrieval');
const { generateEmbedding } = require('../services/gemini');
const { admin, initializeFirebase } = require('../config/firebase');
const { COLLECTIONS } = require('../config/firestore-schema');

// Initialize Firebase
initializeFirebase();

async function verifyRAG(eventCode = 'HTXO9B') {
    console.log(`🧪 Verifying RAG Flow for Event: ${eventCode}...`);

    // 1. Check API Key
    if (!process.env.GEMINI_API_KEY) {
        console.error('❌ GEMINI_API_KEY is missing in .env');
        process.exit(1);
    }
    console.log('✅ GEMINI_API_KEY found');

    // 2. Test Embedding Generation
    try {
        console.log('Testing embedding generation...');
        const embedding = await generateEmbedding('Test query');
        if (embedding && embedding.length > 0) {
            console.log('✅ Embedding generated successfully');
        } else {
            throw new Error('Empty embedding returned');
        }
    } catch (error) {
        console.error('❌ Embedding generation failed:', error.message);
    }

    // 3. Test Direct Text Generation
    try {
        console.log('Testing direct text generation...');
        const { generateText } = require('../services/gemini');
        const text = await generateText('Say hello');
        console.log('✅ Text generation successful:', text);
    } catch (error) {
        console.error('❌ Text generation failed:', error.message);
    }

    // 4. Test RAG Answer with Real Event
    try {
        console.log('Testing answer generation with real event...');
        const db = admin.firestore();

        // Find Event ID
        const eventsSnapshot = await db.collection(COLLECTIONS.EVENTS)
            .where('eventCode', '==', eventCode.toUpperCase())
            .limit(1)
            .get();

        if (eventsSnapshot.empty) {
            console.error('❌ Event not found for testing');
            return;
        }

        const eventId = eventsSnapshot.docs[0].id;
        console.log(`Found event ID: ${eventId}`);

        const question = process.argv[3] || 'where is the location of the event';
        console.log(`❓ Question: ${question}`);

        const answer = await answerQuestion(eventId, question);
        console.log('✅ Answer:', answer);
    } catch (error) {
        console.error('❌ Answer generation failed!');
        if (error.response) {
            console.error('API Error Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error Message:', error.message);
        }
    }

    console.log('\n✨ RAG Verification Complete');
    process.exit(0);
}

const eventCode = process.argv[2] || 'HTXO9B';
verifyRAG(eventCode);

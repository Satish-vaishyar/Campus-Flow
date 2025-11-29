require('dotenv').config();
const { generateText } = require('../services/gemini');

async function test() {
    try {
        console.log('Testing generateText with gemini-1.5-flash...');
        const text = await generateText('Hi');
        console.log('Success:', text);
    } catch (error) {
        console.error('FAIL:', error.message);
    }
}

test();

require('dotenv').config();
const axios = require('axios');

async function test() {
    const key = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`;

    try {
        console.log('Sending request to gemini-flash-latest...');
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: 'Hi' }] }]
        });
        console.log('OK:', response.status);
        console.log('TEXT:', response.data.candidates[0].content.parts[0].text);
    } catch (error) {
        console.log('ERR:', error.message);
        if (error.response) {
            console.log('DATA:', JSON.stringify(error.response.data));
        }
    }
}

test();

/**
 * Smoke Tests for Event Management System
 * 
 * Run with: node tests/smoke-tests.js
 */

const axios = require('axios');
const assert = require('assert');

const API_URL = process.env.API_URL || 'http://localhost:5001';
const SUCCESS = '✅';
const FAIL = '❌';

let testEventId = null;
let testOrderId = null;

async function testHealthCheck() {
    console.log('\n🧪 Testing Health Check...');
    try {
        const response = await axios.get(`${API_URL}/health`);
        assert.strictEqual(response.data.status, 'ok');
        console.log(`${SUCCESS} Health check passed`);
        return true;
    } catch (error) {
        console.error(`${FAIL} Health check failed:`, error.message);
        return false;
    }
}

async function testCreateEvent() {
    console.log('\n🧪 Testing Create Event...');
    try {
        const eventData = {
            name: 'Test Event',
            description: 'This is a test event',
            location: {
                address: 'Test Location',
                lat: 28.6139,
                lng: 77.2090
            },
            date: new Date().toISOString(),
            ticketPrice: 100,
            organizerId: 'test-organizer-123'
        };

        const response = await axios.post(`${API_URL}/api/events`, eventData);
        assert.ok(response.data.id);
        assert.strictEqual(response.data.name, eventData.name);

        testEventId = response.data.id;
        console.log(`${SUCCESS} Event created with ID:`, testEventId);
        return true;
    } catch (error) {
        console.error(`${FAIL} Create event failed:`, error.response?.data || error.message);
        return false;
    }
}

async function testGetEvent() {
    console.log('\n🧪 Testing Get Event...');
    try {
        const response = await axios.get(`${API_URL}/api/events/${testEventId}`);
        assert.strictEqual(response.data.id, testEventId);
        assert.strictEqual(response.data.name, 'Test Event');
        console.log(`${SUCCESS} Event retrieved successfully`);
        return true;
    } catch (error) {
        console.error(`${FAIL} Get event failed:`, error.message);
        return false;
    }
}

async function testCreateRegistration() {
    console.log('\n🧪 Testing Create Registration...');
    try {
        const regData = {
            eventId: testEventId,
            name: 'Test User',
            email: 'test@example.com',
            userId: 'test-user-123'
        };

        const response = await axios.post(`${API_URL}/api/registrations`, regData);
        assert.ok(response.data.orderId);
        assert.ok(response.data.registrationId);

        testOrderId = response.data.orderId;
        console.log(`${SUCCESS} Registration created with order ID:`, testOrderId);
        return true;
    } catch (error) {
        console.error(`${FAIL} Create registration failed:`, error.response?.data || error.message);
        return false;
    }
}

async function testPaymentVerification() {
    console.log('\n🧪 Testing Payment Verification (will fail - demo only)...');
    try {
        const verifyData = {
            razorpay_order_id: testOrderId,
            razorpay_payment_id: 'test_payment_123',
            razorpay_signature: 'invalid_signature_for_demo'
        };

        await axios.post(`${API_URL}/api/registrations/verify-payment`, verifyData);
        console.log(`${FAIL} Payment verification should have failed (invalid signature)`);
        return false;
    } catch (error) {
        if (error.response?.status === 400) {
            console.log(`${SUCCESS} Payment verification properly rejected invalid signature`);
            return true;
        } else {
            console.error(`${FAIL} Unexpected error:`, error.message);
            return false;
        }
    }
}

async function testTelegramWebhook() {
    console.log('\n🧪 Testing Telegram Webhook...');
    try {
        const update = {
            message: {
                chat: { id: 12345 },
                from: { id: 12345, username: 'testuser' },
                text: 'Test message'
            }
        };

        const response = await axios.post(`${API_URL}/webhook/telegram`, update);
        assert.strictEqual(response.data.ok, true);
        console.log(`${SUCCESS} Telegram webhook accepted`);
        return true;
    } catch (error) {
        console.error(`${FAIL} Telegram webhook failed:`, error.message);
        return false;
    }
}

async function runAllTests() {
    console.log('🚀 Starting Smoke Tests...');
    console.log('API URL:', API_URL);

    const results = [];

    results.push(await testHealthCheck());
    results.push(await testCreateEvent());

    if (testEventId) {
        results.push(await testGetEvent());
        results.push(await testCreateRegistration());

        if (testOrderId) {
            results.push(await testPaymentVerification());
        }
    }

    results.push(await testTelegramWebhook());

    const passed = results.filter(r => r).length;
    const total = results.length;

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Test Results: ${passed}/${total} passed`);
    console.log('='.repeat(50));

    if (passed === total) {
        console.log(`\n${SUCCESS} All tests passed!`);
        process.exit(0);
    } else {
        console.log(`\n${FAIL} Some tests failed`);
        process.exit(1);
    }
}

// Run tests
runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

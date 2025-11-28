const express = require('express');
const { handleTelegramWebhook } = require('../services/telegram');
const { verifyWebhookSignature, handlePaymentSuccess, handlePaymentFailure } = require('../services/razorpay');

const router = express.Router();

/**
 * POST /webhook/telegram - Telegram bot webhook
 */
router.post('/telegram', async (req, res) => {
    try {
        const update = req.body;
        console.log('📨 Received Telegram Webhook:', JSON.stringify(update, null, 2));

        // Handle webhook asynchronously
        handleTelegramWebhook(update).catch(error => {
            console.error('Telegram webhook handling error:', error);
        });

        // Respond immediately to Telegram
        res.json({ ok: true });
    } catch (error) {
        console.error('Telegram webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

/**
 * POST /webhook/razorpay - Razorpay payment webhook
 */
router.post('/razorpay', async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const payload = JSON.stringify(req.body);

        // Verify webhook signature
        const isValid = verifyWebhookSignature(payload, signature);

        if (!isValid) {
            console.error('Invalid Razorpay webhook signature');
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const event = req.body.event;
        const payment = req.body.payload.payment.entity;

        // Handle different event types
        if (event === 'payment.captured') {
            await handlePaymentSuccess(payment.order_id, payment.id);
        } else if (event === 'payment.failed') {
            await handlePaymentFailure(payment.order_id);
        }

        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Razorpay webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

/**
 * POST /webhook/poll - Send Telegram poll (called from admin UI)
 */
router.post('/poll', async (req, res) => {
    try {
        const { sendTelegramPoll } = require('../services/telegram');
        const { chatId, question, options } = req.body;

        await sendTelegramPoll(chatId, question, options);

        res.json({ success: true });
    } catch (error) {
        console.error('Poll sending error:', error);
        res.status(500).json({ error: 'Failed to send poll' });
    }
});

module.exports = router;

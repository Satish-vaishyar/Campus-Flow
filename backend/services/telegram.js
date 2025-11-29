const axios = require('axios');
const { admin } = require('../config/firebase');
const { answerQuestion } = require('./retrieval');
const { classifyMessage } = require('./classification');
const { COLLECTIONS, TICKET_STATUS, TICKET_CATEGORY } = require('../config/firestore-schema');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Send typing action
 */
async function sendTypingAction(chatId) {
    try {
        await axios.post(`${TELEGRAM_API}/sendChatAction`, {
            chat_id: chatId,
            action: 'typing'
        });
    } catch (error) {
        console.error('Failed to send typing action:', error.message);
    }
}

/**
 * Send message to Telegram user
 */
async function sendTelegramMessage(chatId, text) {
    console.log(`📤 Sending Telegram message to ${chatId}: ${text.substring(0, 50)}...`);
    try {
        const response = await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text,
            parse_mode: 'Markdown'
        });
        console.log(`✅ Sent message to chat ${chatId}, Response: ${response.status}`);
    } catch (error) {
        console.error('❌ Telegram send error (Markdown):', error.response?.data || error.message);

        // Retry without Markdown if it was a parsing error
        if (error.response?.data?.error_code === 400) {
            console.log('🔄 Retrying as plain text...');
            try {
                await axios.post(`${TELEGRAM_API}/sendMessage`, {
                    chat_id: chatId,
                    text
                });
                console.log(`✅ Sent plain text message to chat ${chatId}`);
            } catch (retryError) {
                console.error('❌ Retry failed:', retryError.response?.data || retryError.message);
            }
        }
    }
}

/**
 * Send poll to Telegram chat
 */
async function sendTelegramPoll(chatId, question, options) {
    try {
        await axios.post(`${TELEGRAM_API}/sendPoll`, {
            chat_id: chatId,
            question,
            options,
            is_anonymous: false
        });
        console.log(`✅ Sent poll to chat ${chatId}`);
    } catch (error) {
        console.error('Telegram poll error:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Find user's event by eventCode or registration
 */
async function findUserEvent(userId, eventCode = null) {
    const db = admin.firestore();

    // If eventCode provided, find event directly
    if (eventCode) {
        const eventsSnapshot = await db.collection(COLLECTIONS.EVENTS)
            .where('eventCode', '==', eventCode.toUpperCase())
            .limit(1)
            .get();

        if (!eventsSnapshot.empty) {
            return { id: eventsSnapshot.docs[0].id, ...eventsSnapshot.docs[0].data() };
        }
    }

    // Otherwise, find by registration
    const regsSnapshot = await db.collection(COLLECTIONS.REGISTRATIONS)
        .where('telegramUserId', '==', userId.toString())
        .limit(1)
        .get();

    if (!regsSnapshot.empty) {
        const reg = regsSnapshot.docs[0].data();
        const eventDoc = await db.collection(COLLECTIONS.EVENTS).doc(reg.eventId).get();
        if (eventDoc.exists) {
            return { id: eventDoc.id, ...eventDoc.data() };
        }
    }

    return null;
}

/**
 * Handle /join command
 */
async function handleJoinCommand(chatId, userId, username, eventCode) {
    const db = admin.firestore();

    const event = await findUserEvent(userId, eventCode);
    if (!event) {
        await sendTelegramMessage(chatId, '❌ Event not found. Please check the event code.');
        return;
    }

    // Check if already registered
    const existingReg = await db.collection(COLLECTIONS.REGISTRATIONS)
        .where('eventId', '==', event.id)
        .where('telegramUserId', '==', userId.toString())
        .limit(1)
        .get();

    if (!existingReg.empty) {
        await sendTelegramMessage(chatId, `✅ You're already registered for *${event.name}*!\n\nAsk me any questions about the event.`);
        return;
    }

    // Create registration (unpaid - they still need to pay via web)
    await db.collection(COLLECTIONS.REGISTRATIONS).add({
        eventId: event.id,
        userId: userId.toString(),
        name: username || 'Telegram User',
        email: '',
        telegramUserId: userId.toString(),
        telegramChatId: chatId.toString(),
        paymentStatus: 'pending',
        amount: event.ticketPrice || 0,
        registeredAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await sendTelegramMessage(chatId,
        `🎉 Welcome to *${event.name}*!\n\n` +
        `Complete your registration and payment at: [Event Page](${process.env.FRONTEND_URL}/events/${event.id})\n\n` +
        `You can ask me questions about the event anytime!`
    );
}

/**
 * Handle /faq command
 */
async function handleFaqCommand(chatId, userId) {
    await sendTelegramMessage(chatId,
        `❓ *Frequently Asked Questions*\n\n` +
        `• Use /join <eventcode> to join an event\n` +
        `• Ask me any question about the event\n` +
        `• Use /report to flag an issue\n\n` +
        `Just send me your question, and I'll answer based on event documents!`
    );
}

/**
 * Handle /report command
 */
async function handleReportCommand(chatId, userId, reportText) {
    const db = admin.firestore();

    if (!reportText) {
        await sendTelegramMessage(chatId, 'Please provide details: /report <your issue>');
        return;
    }

    const event = await findUserEvent(userId);
    if (!event) {
        await sendTelegramMessage(chatId, '❌ You need to join an event first using /join <eventcode>');
        return;
    }

    // Create ticket
    const ticketRef = await db.collection(COLLECTIONS.TICKETS).add({
        eventId: event.id,
        userId: userId.toString(),
        chatId: chatId.toString(),
        message: reportText,
        category: TICKET_CATEGORY.REPORT,
        status: TICKET_STATUS.OPEN,
        shouldFlag: true,
        confidence: 1.0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await sendTelegramMessage(chatId, '✅ Report submitted. The organizer will respond shortly.');

    // Notify organizer
    if (event.organizerTelegramChatId) {
        await sendTelegramMessage(event.organizerTelegramChatId,
            `🚨 *New Report* for ${event.name}\n\n` +
            `From: User ${userId}\n` +
            `Message: ${reportText}\n\n` +
            `Ticket ID: ${ticketRef.id}`
        );
    }
}

/**
 * Handle regular message (FAQ question)
 */
async function handleMessage(chatId, userId, username, messageText) {
    const db = admin.firestore();

    const event = await findUserEvent(userId);
    if (!event) {
        await sendTelegramMessage(chatId,
            '👋 Welcome! Please join an event first using:\n\n/join <eventcode>\n\n' +
            'You can get the event code from your event organizer.'
        );
        return;
    }

    // Log message
    await db.collection(COLLECTIONS.MESSAGES).add({
        eventId: event.id,
        userId: userId.toString(),
        chatId: chatId.toString(),
        message: messageText,
        fromOrganizer: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Classify message
    const classification = await classifyMessage(messageText);

    // Try to answer via RAG
    let autoAnswer = null;
    try {
        await sendTypingAction(chatId);
        autoAnswer = await answerQuestion(event.id, messageText);
    } catch (error) {
        console.error('RAG error:', error);
        console.error('RAG error details:', error.response?.data || error.message);
        autoAnswer = "I'm having trouble accessing event information. Let me create a ticket for the organizer.";
    }

    // If should flag or low confidence, create ticket
    if (classification.should_flag || classification.confidence < 0.7) {
        const ticketRef = await db.collection(COLLECTIONS.TICKETS).add({
            eventId: event.id,
            userId: userId.toString(),
            chatId: chatId.toString(),
            message: messageText,
            category: TICKET_CATEGORY.FAQ,
            status: TICKET_STATUS.OPEN,
            shouldFlag: classification.should_flag,
            confidence: classification.confidence,
            autoAnswer,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Send auto-answer but mention organizer will review
        await sendTelegramMessage(chatId,
            `${autoAnswer}\n\n_Your question has been forwarded to the organizer for review._`
        );

        // Notify organizer
        if (event.organizerTelegramChatId) {
            await sendTelegramMessage(event.organizerTelegramChatId,
                `📩 *New Question* for ${event.name}\n\n` +
                `From: ${username || userId}\n` +
                `Question: ${messageText}\n\n` +
                `Auto-answer: ${autoAnswer}\n\n` +
                `Ticket ID: ${ticketRef.id}`
            );
        }
    } else {
        // High confidence - just send answer
        await sendTelegramMessage(chatId, autoAnswer);
    }
}

/**
 * Handle Telegram webhook
 */
async function handleTelegramWebhook(update) {
    console.log('🔄 Processing webhook update:', JSON.stringify(update));
    if (!update.message) {
        console.log('⚠️ Update has no message, ignoring');
        return;
    }

    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    const username = update.message.from.username || update.message.from.first_name;
    const text = update.message.text;

    console.log(`👤 User: ${username} (${userId}), Chat: ${chatId}, Text: ${text}`);

    if (!text) {
        console.log('⚠️ Message has no text, ignoring');
        return;
    }

    // Handle commands
    if (text.startsWith('/join')) {
        console.log('👉 Handling /join command');
        const eventCode = text.split(' ')[1];
        await handleJoinCommand(chatId, userId, username, eventCode);
    } else if (text === '/faq') {
        console.log('👉 Handling /faq command');
        await handleFaqCommand(chatId, userId);
    } else if (text.startsWith('/report')) {
        console.log('👉 Handling /report command');
        const reportText = text.replace('/report', '').trim();
        await handleReportCommand(chatId, userId, reportText);
    } else {
        console.log('👉 Handling regular message');
        // Regular message
        await handleMessage(chatId, userId, username, text);
    }
}

/**
 * Send organizer reply to attendee
 */
async function sendOrganizerReply(ticketId, replyText) {
    const db = admin.firestore();

    const ticketDoc = await db.collection(COLLECTIONS.TICKETS).doc(ticketId).get();
    if (!ticketDoc.exists) {
        throw new Error('Ticket not found');
    }

    const ticket = ticketDoc.data();

    // Update ticket
    await db.collection(COLLECTIONS.TICKETS).doc(ticketId).update({
        organizerReply: replyText,
        status: TICKET_STATUS.ANSWERED,
        answeredAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Send to attendee
    await sendTelegramMessage(ticket.chatId, `📧 *Organizer Reply:*\n\n${replyText}`);

    // Log message
    await db.collection(COLLECTIONS.MESSAGES).add({
        eventId: ticket.eventId,
        userId: ticket.userId,
        chatId: ticket.chatId,
        message: replyText,
        fromOrganizer: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

module.exports = {
    sendTelegramMessage,
    sendTelegramPoll,
    handleTelegramWebhook,
    sendOrganizerReply
};

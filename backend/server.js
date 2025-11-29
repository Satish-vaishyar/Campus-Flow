<<<<<<< HEAD
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeFirebase } = require('./config/firebase');
const { initMongoDB } = require('./config/mongodb');
=======
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const { initializeFirebase } = require("./config/firebase");

// Log loaded env vars for debugging
console.log("Environment loaded:", {
  PORT: process.env.PORT,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID ? "SET" : "NOT SET",
  NODE_ENV: process.env.NODE_ENV,
});
>>>>>>> 9fa57f41580550eb3e4e66c6595960192985aea1

// Initialize Firebase
initializeFirebase();

// Initialize MongoDB for file storage
initMongoDB().catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    console.log('⚠️  Document upload features will not work without MongoDB');
});

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware - Allow all origins for development
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/events", require("./routes/events"));
app.use("/api/registrations", require("./routes/registrations"));
app.use("/api/tickets", require("./routes/tickets"));
app.use("/webhook", require("./routes/webhooks"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Global error handlers to prevent crash
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

// Start server
app.listen(PORT, () => {
<<<<<<< HEAD
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`🌐 API: http://localhost:${PORT}/api`);
    console.log(`🪝 Webhooks: http://localhost:${PORT}/webhook`);
    console.log(`\nTo setup Telegram webhook:`);
    console.log(`1. Start ngrok: ngrok http ${PORT}`);
    console.log(`2. Set webhook: https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=<YOUR_NGROK_URL>/webhook/telegram`);
=======
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 API: http://localhost:${PORT}/api`);
  console.log(`🪝 Webhooks: http://localhost:${PORT}/webhook`);
>>>>>>> 9fa57f41580550eb3e4e66c6595960192985aea1
});

module.exports = app;

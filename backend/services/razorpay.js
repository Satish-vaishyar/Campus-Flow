const crypto = require("crypto");
const axios = require("axios");
const { admin } = require("../config/firebase");
const { COLLECTIONS, PAYMENT_STATUS } = require("../config/firestore-schema");

// Get credentials from environment (read at runtime, not module load time)
const getCredentials = () => ({
  keyId: process.env.RAZORPAY_KEY_ID,
  keySecret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Create Razorpay order
 */
async function createOrder(amount, receiptId, notes = {}) {
  // Don't create order for free events
  if (!amount || amount <= 0) {
    return {
      id: null,
      amount: 0,
      currency: "INR",
      receipt: receiptId,
      notes,
    };
  }

  const { keyId, keySecret } = getCredentials();

  // Check if Razorpay credentials are configured
  if (!keyId || !keySecret) {
    console.error("Razorpay credentials not configured. KEY_ID:", keyId ? "set" : "missing", "SECRET:", keySecret ? "set" : "missing");
    throw new Error("Payment gateway not configured");
  }

  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    console.log(`Creating Razorpay order: amount=${amount}, receipt=${receiptId}`);

    const response = await axios.post(
      "https://api.razorpay.com/v1/orders",
      {
        amount: amount * 100, // Convert to paise
        currency: "INR",
        receipt: receiptId,
        notes,
      },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Razorpay order created successfully:", response.data.id);
    return response.data;
  } catch (error) {
    console.error(
      "Razorpay order creation error:",
      error.response?.data || error.message
    );
    console.error("Full error:", JSON.stringify(error.response?.data, null, 2));
    throw new Error("Failed to create payment order");
  }
}

/**
 * Verify Razorpay payment signature
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
  const { keySecret } = getCredentials();
  const text = `${orderId}|${paymentId}`;
  const generated_signature = crypto
    .createHmac("sha256", keySecret)
    .update(text)
    .digest("hex");

  return generated_signature === signature;
}

/**
 * Verify Razorpay webhook signature
 */
function verifyWebhookSignature(payload, signature) {
  const { keySecret } = getCredentials();
  const generated_signature = crypto
    .createHmac("sha256", keySecret)
    .update(payload)
    .digest("hex");

  return generated_signature === signature;
}

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(orderId, paymentId) {
  const db = admin.firestore();

  // Find registration by orderId
  const regsSnapshot = await db
    .collection(COLLECTIONS.REGISTRATIONS)
    .where("razorpayOrderId", "==", orderId)
    .limit(1)
    .get();

  if (regsSnapshot.empty) {
    console.error("Registration not found for order:", orderId);
    return;
  }

  const regDoc = regsSnapshot.docs[0];

  // Update registration
  await regDoc.ref.update({
    paymentStatus: PAYMENT_STATUS.PAID,
    razorpayPaymentId: paymentId,
    paidAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`✅ Payment successful for registration ${regDoc.id}`);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailure(orderId) {
  const db = admin.firestore();

  const regsSnapshot = await db
    .collection(COLLECTIONS.REGISTRATIONS)
    .where("razorpayOrderId", "==", orderId)
    .limit(1)
    .get();

  if (regsSnapshot.empty) {
    console.error("Registration not found for order:", orderId);
    return;
  }

  const regDoc = regsSnapshot.docs[0];

  await regDoc.ref.update({
    paymentStatus: PAYMENT_STATUS.FAILED,
  });

  console.log(`❌ Payment failed for registration ${regDoc.id}`);
}

module.exports = {
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  handlePaymentSuccess,
  handlePaymentFailure,
};

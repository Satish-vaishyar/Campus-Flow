const express = require("express");
const { admin } = require("../config/firebase");
const { COLLECTIONS, PAYMENT_STATUS } = require("../config/firestore-schema");
const { createOrder, verifyPaymentSignature } = require("../services/razorpay");

const router = express.Router();

/**
 * Helper to convert registration timestamps
 */
const convertRegistrationDates = (data) => {
  const reg = { ...data };
  if (reg.registeredAt && typeof reg.registeredAt.toDate === "function") {
    reg.createdAt = reg.registeredAt.toDate().toISOString();
  }
  if (reg.paidAt && typeof reg.paidAt.toDate === "function") {
    reg.paidAt = reg.paidAt.toDate().toISOString();
  }
  return reg;
};

/**
 * GET /api/registrations - List registrations (with optional eventId filter)
 */
router.get("/", async (req, res) => {
  try {
    const db = admin.firestore();
    const { eventId, userId } = req.query;

    let query = db.collection(COLLECTIONS.REGISTRATIONS);

    if (eventId) {
      query = query.where("eventId", "==", eventId);
    }

    if (userId) {
      query = query.where("userId", "==", userId);
    }

    const snapshot = await query.get();

    const registrations = [];
    snapshot.forEach((doc) => {
      registrations.push(
        convertRegistrationDates({ id: doc.id, ...doc.data() })
      );
    });

    res.json({ registrations });
  } catch (error) {
    console.error("Error fetching registrations:", error);
    res.status(500).json({ error: "Failed to fetch registrations" });
  }
});

/**
 * GET /api/registrations/:eventCode - List registrations for a specific event by code
 */
router.get("/:eventCode", async (req, res) => {
  try {
    const db = admin.firestore();
    const { eventCode } = req.params;

    // Find event by eventCode
    const eventsSnapshot = await db
      .collection(COLLECTIONS.EVENTS)
      .where("eventCode", "==", eventCode)
      .limit(1)
      .get();

    if (eventsSnapshot.empty) {
      return res.status(404).json({ error: "Event not found" });
    }

    const eventId = eventsSnapshot.docs[0].id;

    // Get registrations for this event
    const snapshot = await db
      .collection(COLLECTIONS.REGISTRATIONS)
      .where("eventId", "==", eventId)
      .get();

    const registrations = [];
    snapshot.forEach((doc) => {
      registrations.push(
        convertRegistrationDates({ id: doc.id, ...doc.data() })
      );
    });

    res.json({ registrations });
  } catch (error) {
    console.error("Error fetching registrations:", error);
    res.status(500).json({ error: "Failed to fetch registrations" });
  }
});

/**
 * POST /api/registrations - Create registration and payment order
 */
router.post("/", async (req, res) => {
  try {
    const db = admin.firestore();
    const {
      eventId,
      eventCode,
      name,
      email,
      phone,
      userId,
      answers,
      amount: providedAmount,
    } = req.body;

    let eventDoc;
    let actualEventId = eventId;

    // Find event by either eventId or eventCode
    if (eventCode && !eventId) {
      const eventsSnapshot = await db
        .collection(COLLECTIONS.EVENTS)
        .where("eventCode", "==", eventCode)
        .limit(1)
        .get();

      if (eventsSnapshot.empty) {
        return res.status(404).json({ error: "Event not found" });
      }

      eventDoc = eventsSnapshot.docs[0];
      actualEventId = eventDoc.id;
    } else if (eventId) {
      eventDoc = await db.collection(COLLECTIONS.EVENTS).doc(eventId).get();
      if (!eventDoc.exists) {
        return res.status(404).json({ error: "Event not found" });
      }
    } else {
      return res
        .status(400)
        .json({ error: "Either eventId or eventCode is required" });
    }

    const event = eventDoc.data();
    const amount =
      providedAmount !== undefined ? providedAmount : event.ticketPrice || 0;

    // Create registration record
    const registrationData = {
      eventId: actualEventId,
      eventCode: event.eventCode || eventCode,
      userId: userId || "",
      name,
      email,
      phone: phone || "",
      answers: answers || {},
      eventName: event.name || "",
      eventDate: event.date || null,
      eventLocation: event.location || null,
      paymentStatus: amount > 0 ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.PAID,
      amount,
      registeredAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const regRef = await db
      .collection(COLLECTIONS.REGISTRATIONS)
      .add(registrationData);

    // If free event, return success immediately
    if (amount <= 0) {
      return res.status(201).json({
        registration: { id: regRef.id, ...registrationData },
        orderId: null,
        amount: 0,
        currency: "INR",
        isFree: true,
      });
    }

    // Create Razorpay order for paid events
    const order = await createOrder(amount, regRef.id, {
      eventId: actualEventId,
      eventCode: event.eventCode || eventCode,
      registrationId: regRef.id,
    });

    // Update registration with order ID
    await regRef.update({
      razorpayOrderId: order.id,
    });

    res.status(201).json({
      registration: {
        id: regRef.id,
        ...registrationData,
        razorpayOrderId: order.id,
      },
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      isFree: false,
    });
  } catch (error) {
    console.error("Error creating registration:", error);
    res
      .status(500)
      .json({ error: "Failed to create registration", details: error.message });
  }
});

/**
 * POST /api/registrations/verify-payment - Verify payment
 */
router.post("/verify-payment", async (req, res) => {
  try {
    // Support both snake_case (Razorpay direct) and camelCase (frontend) parameter names
    const razorpay_order_id =
      req.body.razorpay_order_id || req.body.razorpayOrderId;
    const razorpay_payment_id =
      req.body.razorpay_payment_id || req.body.razorpayPaymentId;
    const razorpay_signature =
      req.body.razorpay_signature || req.body.razorpaySignature;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ error: "Missing required payment verification parameters" });
    }

    // Verify signature
    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    // Update registration
    const db = admin.firestore();
    const regsSnapshot = await db
      .collection(COLLECTIONS.REGISTRATIONS)
      .where("razorpayOrderId", "==", razorpay_order_id)
      .limit(1)
      .get();

    if (regsSnapshot.empty) {
      return res.status(404).json({ error: "Registration not found" });
    }

    const regDoc = regsSnapshot.docs[0];
    await regDoc.ref.update({
      paymentStatus: PAYMENT_STATUS.PAID,
      razorpayPaymentId: razorpay_payment_id,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updatedReg = await regDoc.ref.get();
    const registrationData = convertRegistrationDates({
      id: regDoc.id,
      ...updatedReg.data(),
    });

    res.json({
      success: true,
      message: "Payment verified successfully",
      registration: registrationData,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

module.exports = router;

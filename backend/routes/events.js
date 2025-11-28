const express = require("express");
const { admin } = require("../config/firebase");
const { COLLECTIONS } = require("../config/firestore-schema");
const { ingestDocument } = require("../services/ingestion");
const multer = require("multer");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Helper to convert Firestore timestamps to ISO strings and flatten location
 */
const convertEventDates = (data) => {
  const event = { ...data };
  if (event.date && typeof event.date.toDate === "function") {
    event.date = event.date.toDate().toISOString();
  }
  if (event.createdAt && typeof event.createdAt.toDate === "function") {
    event.createdAt = event.createdAt.toDate().toISOString();
  }
  if (event.updatedAt && typeof event.updatedAt.toDate === "function") {
    event.updatedAt = event.updatedAt.toDate().toISOString();
  }
  // Map eventCode to code for frontend compatibility
  if (event.eventCode) {
    event.code = event.eventCode;
  }
  // Flatten location object for frontend compatibility
  if (event.location && typeof event.location === "object") {
    event.lat = event.location.lat || 0;
    event.lng = event.location.lng || 0;
    event.address = event.location.address || "";
  }
  // Map organizerTelegramChatId to telegramChatId for frontend
  if (event.organizerTelegramChatId) {
    event.telegramChatId = event.organizerTelegramChatId;
  }
  // Map indoorMapUrl and indoorMapPOIs to indoorMap object for frontend
  if (event.indoorMapUrl) {
    event.indoorMap = {
      url: event.indoorMapUrl,
      pois: event.indoorMapPOIs || [],
    };
  }
  return event;
};

/**
 * GET /api/events - List all events
 */
router.get("/", async (req, res) => {
  try {
    const db = admin.firestore();
    let query = db.collection(COLLECTIONS.EVENTS);

    // Filter by userId if provided
    if (req.query.userId) {
      query = query.where("organizerId", "==", req.query.userId);
    }

    const snapshot = await query.get();

    const events = [];
    snapshot.forEach((doc) => {
      events.push(convertEventDates({ id: doc.id, ...doc.data() }));
    });

    console.log(`Fetched ${events.length} events`);
    res.json({ events });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

/**
 * GET /api/events/:id - Get event by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const db = admin.firestore();
    let doc = await db.collection(COLLECTIONS.EVENTS).doc(req.params.id).get();

    if (!doc.exists) {
      // Try finding by eventCode
      const snapshot = await db
        .collection(COLLECTIONS.EVENTS)
        .where("eventCode", "==", req.params.id)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return res.status(404).json({ error: "Event not found" });
      }

      doc = snapshot.docs[0];
    }

    res.json(convertEventDates({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

/**
 * POST /api/events - Create new event
 */
router.post("/", async (req, res) => {
  try {
    console.log("Received create event request:", req.body);
    const db = admin.firestore();
    // Accept both userId and organizerId for backwards compatibility
    const {
      name,
      description,
      location,
      address,
      lat,
      lng,
      date,
      ticketPrice,
      organizerId,
      userId,
      organizerTelegramChatId,
      telegramChatId,
      formSchema,
    } = req.body;

    // Use userId if provided, otherwise fall back to organizerId
    const actualOrganizerId = userId || organizerId;

    // Validate required fields
    if (!actualOrganizerId) {
      console.error("Missing userId or organizerId");
      return res.status(400).json({
        error: "Missing required field: userId or organizerId",
      });
    }

    // Validate date
    const eventDate = new Date(date);
    if (isNaN(eventDate.getTime())) {
      console.error("Invalid date:", date);
      return res.status(400).json({ error: "Invalid date format" });
    }

    // Generate unique event code
    const eventCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Build location object according to Firestore schema
    // Schema expects: location: { lat: number, lng: number, address: string }
    let locationData;
    if (location && typeof location === "object") {
      // If location is already an object, use it
      locationData = location;
    } else {
      // Build location object from separate fields
      locationData = {
        address: address || location || "",
        lat: lat || 0,
        lng: lng || 0,
      };
    }

    const eventData = {
      name,
      description,
      eventCode,
      organizerId: actualOrganizerId,
      organizerTelegramChatId:
        telegramChatId || organizerTelegramChatId || null,
      location: locationData,
      date: admin.firestore.Timestamp.fromDate(eventDate),
      ticketPrice: ticketPrice || 0,
      indoorMapUrl: null,
      indoorMapPOIs: [],
      formSchema: formSchema || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection(COLLECTIONS.EVENTS).add(eventData);

    res.status(201).json({ id: docRef.id, code: eventCode, ...eventData });
  } catch (error) {
    console.error("Error creating event:", error);
    console.error("Request body:", req.body);
    res
      .status(500)
      .json({ error: "Failed to create event", details: error.message });
  }
});

/**
 * PUT /api/events/:id - Update event
 */
router.put("/:id", async (req, res) => {
  try {
    const db = admin.firestore();
    const {
      name,
      description,
      location,
      date,
      ticketPrice,
      organizerTelegramChatId,
      formSchema,
    } = req.body;

    const updateData = {
      ...(name && { name }),
      ...(description && { description }),
      ...(location && { location }),
      ...(date && { date: admin.firestore.Timestamp.fromDate(new Date(date)) }),
      ...(ticketPrice !== undefined && { ticketPrice }),
      ...(organizerTelegramChatId !== undefined && { organizerTelegramChatId }),
      ...(formSchema && { formSchema }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db
      .collection(COLLECTIONS.EVENTS)
      .doc(req.params.id)
      .update(updateData);

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ error: "Failed to update event" });
  }
});

/**
 * DELETE /api/events/:id - Delete event and all related data
 */
router.delete("/:id", async (req, res) => {
  try {
    const db = admin.firestore();
    const eventId = req.params.id;

    // Get event to check if it exists
    const eventDoc = await db.collection(COLLECTIONS.EVENTS).doc(eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Delete all related data in a batch
    const batch = db.batch();

    // Delete registrations
    const registrations = await db
      .collection(COLLECTIONS.EVENTS)
      .doc(eventId)
      .collection("registrations")
      .get();
    registrations.forEach((doc) => batch.delete(doc.ref));

    // Delete tickets
    const tickets = await db
      .collection(COLLECTIONS.EVENTS)
      .doc(eventId)
      .collection("tickets")
      .get();
    tickets.forEach((doc) => batch.delete(doc.ref));

    // Delete chunks (RAG data)
    const chunks = await db
      .collection(COLLECTIONS.EVENTS)
      .doc(eventId)
      .collection("chunks")
      .get();
    chunks.forEach((doc) => batch.delete(doc.ref));

    // Delete documents
    const documents = await db
      .collection(COLLECTIONS.EVENTS)
      .doc(eventId)
      .collection("documents")
      .get();
    documents.forEach((doc) => batch.delete(doc.ref));

    // Delete the event itself
    batch.delete(db.collection(COLLECTIONS.EVENTS).doc(eventId));

    await batch.commit();

    console.log(`Deleted event ${eventId} and all related data`);
    res.json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

/**
 * POST /api/events/:id/documents - Upload and process document
 */
router.post("/:id/documents", upload.single("file"), async (req, res) => {
  try {
    const db = admin.firestore();
    const eventId = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Upload to Firebase Storage
    const bucket = admin.storage().bucket();
    const storageFilename = `events/${eventId}/documents/${Date.now()}_${
      file.originalname
    }`;
    const fileRef = bucket.file(storageFilename);

    await fileRef.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    const storageUrl = await fileRef.getSignedUrl({
      action: "read",
      expires: "03-01-2500",
    });

    // Create document record
    const docRef = await db
      .collection(COLLECTIONS.EVENTS)
      .doc(eventId)
      .collection("documents")
      .add({
        filename: file.originalname,
        storageUrl: storageUrl[0],
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        processedAt: null,
        chunkCount: 0,
      });

    // Process document asynchronously (in production, use background worker)
    ingestDocument(eventId, docRef.id, file.buffer, file.originalname).catch(
      (error) => console.error("Document processing error:", error)
    );

    res.status(201).json({
      id: docRef.id,
      message: "Document uploaded. Processing in background...",
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

/**
 * POST /api/events/:id/indoor-map - Upload indoor map
 */
router.post("/:id/indoor-map", upload.single("file"), async (req, res) => {
  try {
    const db = admin.firestore();
    const eventId = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Upload to Firebase Storage
    const bucket = admin.storage().bucket();
    const storageFilename = `events/${eventId}/indoor-maps/${Date.now()}_${
      file.originalname
    }`;
    const fileRef = bucket.file(storageFilename);

    await fileRef.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    await fileRef.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storageFilename}`;

    // Update event with indoor map URL
    await db.collection(COLLECTIONS.EVENTS).doc(eventId).update({
      indoorMapUrl: publicUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ indoorMapUrl: publicUrl });
  } catch (error) {
    console.error("Error uploading indoor map:", error);
    res.status(500).json({ error: "Failed to upload indoor map" });
  }
});

/**
 * PUT /api/events/:id/pois - Update POIs for indoor map
 */
router.put("/:id/pois", async (req, res) => {
  try {
    const db = admin.firestore();
    const { pois } = req.body;

    await db.collection(COLLECTIONS.EVENTS).doc(req.params.id).update({
      indoorMapPOIs: pois,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating POIs:", error);
    res.status(500).json({ error: "Failed to update POIs" });
  }
});

module.exports = router;

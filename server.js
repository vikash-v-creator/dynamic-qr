const express = require('express');
const cors = require('cors');
const path = require('path');
const { nanoid } = require('nanoid');
const { db, admin } = require('./firebase');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ── Middleware ────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Request logger (debug — remove after fix confirmed) ──
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ── Firestore refs ───────────────────────────────
const qrsCollection = db.collection('qrs');

// ── Helpers ──────────────────────────────────────

/**
 * Validate that a string is a well-formed http/https URL.
 * Returns the trimmed URL on success, or null on failure.
 */
function validateUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate a unique 7-char ID using nanoid.
 * Checks Firestore for collisions (extremely unlikely but handled).
 */
async function generateUniqueId() {
  const MAX_ATTEMPTS = 5;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const id = nanoid(7);
    const doc = await qrsCollection.doc(id).get();
    if (!doc.exists) return id;
  }
  throw new Error('Failed to generate unique ID after multiple attempts');
}

// ── POST /api/create ─────────────────────────────
// Accepts { url, uid } in body, stores in Firestore, returns short QR link
app.post('/api/create', async (req, res) => {
  try {
    const { url: requestUrl, uid, designConfig } = req.body;
    
    const url = validateUrl(requestUrl);
    if (!url) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const id = await generateUniqueId();
    const now = admin.firestore.FieldValue.serverTimestamp();

    await qrsCollection.doc(id).set({
      url,
      uid: uid || null,
      designConfig: designConfig || {},
      createdAt: now,
      updatedAt: now,
    });

    return res.status(201).json({
      id,
      qrUrl: `${BASE_URL}/q/${id}`,
    });
  } catch (err) {
    console.error('Error creating QR:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/my-qr/:uid ──────────────────────────
// Returns all QRs belonging to a given user UID
app.get('/api/my-qr/:uid', async (req, res) => {
  try {
    // TODO: verify Firebase ID token for real security
    const { uid } = req.params;
    if (!uid) {
      return res.status(400).json({ error: 'Missing uid' });
    }

    const snapshot = await qrsCollection
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();

    const qrs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        url: data.url,
        qrUrl: `${BASE_URL}/q/${doc.id}`,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
      };
    });

    return res.json(qrs);
  } catch (err) {
    console.error('Error fetching user QRs:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/update/:id ─────────────────────────
// Accepts { url } in body, updates existing Firestore doc
app.post('/api/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const url = validateUrl(req.body.url);
    if (!url) {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    
    const designConfig = req.body.designConfig || null;

    const qrsRef = qrsCollection.doc(id);
    const doc = await qrsRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'QR not found' });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const updateData = {
      url,
      updatedAt: now
    };
    
    if (designConfig) {
      updateData.designConfig = designConfig;
    }

    await qrsRef.update(updateData);

    return res.json({ success: true, url, designConfig });
  } catch (err) {
    console.error('Error updating QR:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /test ────────────────────────────────────
// Health check for debugging on Render
app.get('/test', (req, res) => {
  res.send('Server working — routes active');
});

// ── GET /debug — safe route list ─────────────────
app.get('/debug', (req, res) => {
  try {
    res.json({
      status: 'ok',
      routes: [
        'POST /api/create',
        'POST /api/update/:id',
        'GET /test',
        'GET /debug',
        'GET /q/:id',
        'CATCH-ALL (last)'
      ]
    });
  } catch (err) {
    res.status(500).send('Debug failed');
  }
});

// ── GET /q/:id ───────────────────────────────────
// Looks up the short ID in Firestore and redirects (or 404s)
app.get('/q/:id', async (req, res) => {
  const id = req.params.id;
  console.log('QR HIT:', id);

  try {
    const doc = await db.collection('qrs').doc(id).get();
    console.log('DOC EXISTS:', doc.exists);

    if (!doc.exists) {
      console.log('NO DOC FOUND for id:', id);
      return res.status(404).send('Invalid QR');
    }

    const data = doc.data();
    console.log('DATA:', JSON.stringify(data));

    if (!data || !data.url) {
      console.log('DOC exists but no url field');
      return res.status(404).send('Invalid QR - no URL');
    }

    console.log('REDIRECTING TO:', data.url);
    return res.redirect(data.url);
  } catch (err) {
    console.error('FIRESTORE ERROR:', err.message);
    console.error('FULL ERROR:', err);
    return res.status(500).send('Server error');
  }
});

// ── Catch-all: serve frontend for any unmatched route ──
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global error handler ─────────────────────────
app.use((err, req, res, next) => {
  console.error('GLOBAL ERROR:', err);
  res.status(500).send('Internal Server Error');
});

// ── Start server ─────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} → ${BASE_URL}`);
});

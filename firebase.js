const admin = require('firebase-admin');

if (!admin.apps.length) {
  if (!process.env.FIREBASE_KEY) {
    console.error('❌ FIREBASE_KEY environment variable is not set.');
    process.exit(1);
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
  } catch (err) {
    console.error('❌ FIREBASE_KEY is not valid JSON:', err.message);
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

module.exports = { db, admin };

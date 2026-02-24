import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      // SISI KIRI HARUS SNAKE_CASE (pake garis bawah)
      // SISI KANAN HARUS SESUAI DENGAN FILE .ENV ANDA
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    } as any),
  });
}

export const db = admin.firestore();
import * as admin from "firebase-admin";

function getAdminApp(): admin.app.App {
  if (admin.apps.length) return admin.apps[0]!;
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export const adminAuth = () => getAdminApp().auth();
export const adminDb = () => getAdminApp().firestore();

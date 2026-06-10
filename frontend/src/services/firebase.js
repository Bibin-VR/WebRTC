import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth, signInAnonymously } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'tovex-eab23.firebaseapp.com',
  databaseURL: 'https://tovex-eab23-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'tovex-eab23',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'tovex-eab23.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const database = getDatabase(app)

// Sign in anonymously so Firebase rules that check auth != null are satisfied.
// Requires VITE_FIREBASE_API_KEY in frontend/.env and Anonymous auth enabled in Firebase Console.
export const authReady = signInAnonymously(getAuth(app)).catch((err) => {
  console.warn('[firebase] Anonymous auth failed:', err.code, '— DB writes may be blocked by rules')
})

export default app

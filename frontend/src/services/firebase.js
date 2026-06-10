import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

// databaseURL, projectId, authDomain, storageBucket are hardcoded for this deployment.
// apiKey / messagingSenderId / appId can be supplied via .env if Firebase Auth is added later.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'tovex-eab23.firebaseapp.com',
  databaseURL: 'https://tovex-eab23-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'tovex-eab23',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'tovex-eab23.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const database = getDatabase(app)
export default app

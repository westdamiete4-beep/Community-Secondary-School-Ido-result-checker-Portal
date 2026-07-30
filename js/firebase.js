// ============================================================
// firebase.js — single source of truth for Firebase in the app
// Every page imports { db, auth } from this file instead of
// re-initializing the SDK, so we only ever have one App instance.
// ============================================================

// These specifiers ("firebase/app", "firebase/app-check", etc.) are
// resolved by the <script type="importmap"> block in each HTML page's
// <head> — see index.html for the mapping. That's what lets this stay
// a plain static site (no npm, no bundler, deploys to Netlify as-is)
// while still using the exact same modular v9+ import syntax as a
// bundled project would.
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";

// Exact configuration provided for this project — do not change.
const firebaseConfig = {
  apiKey: "AIzaSyDFF23hdhmRTAR2Z1mni8dbyKHOqK3Mqyo",
  authDomain: "community-secondary-scho-befe4.firebaseapp.com",
  projectId: "community-secondary-scho-befe4",
  storageBucket: "community-secondary-scho-befe4.firebasestorage.app",
  messagingSenderId: "835028626055",
  appId: "1:835028626055:web:0b297e3b077e2f0fae6622",
};

const app = initializeApp(firebaseConfig);

// ------------------------------------------------------------
// App Check: proves requests are coming from this real, deployed
// site (not a script, curl, or a copy of this Firebase config
// running somewhere else) before Firestore honors them. Verified
// through Google's reCAPTCHA v3, which runs invisibly — students
// never see a challenge or checkbox.
//
// Initialized immediately after initializeApp(), and before
// getFirestore()/getAuth() below are ever called — so every
// Firestore/Auth request anywhere in the app, from the very first
// page load, is covered.
//
// The string below is the reCAPTCHA "Site Key" — a public identifier
// that's meant to ship in frontend code. The "Secret Key" is never
// used here and must never appear in frontend code; App Check's
// verification of that secret happens entirely on Google/Firebase's
// servers, not in this file.
// ------------------------------------------------------------
// Lets App Check work on localhost during local testing/preview, without
// a real reCAPTCHA pass. Must be set BEFORE initializeAppCheck() runs.
// Register the token this prints in the browser console under
// Firebase Console -> App Check -> Manage debug tokens. Harmless in
// production: this only ever runs when the hostname is literally
// localhost/127.0.0.1, which Netlify's live site never is.
if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider("6Ld4QmotAAAAAOCqjs81dVG0ItOcfiSHRPibEc-o"),
  isTokenAutoRefreshEnabled: true,
});

export const db = getFirestore(app);
export const auth = getAuth(app);

// Re-export the Firestore/Auth helpers we use across pages so every
// other script can pull everything from this one module.
export {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
};

// ------------------------------------------------------------
// Firestore collection names — keep them all in one place so a
// typo doesn't silently create a stray collection.
// ------------------------------------------------------------
export const COLLECTIONS = {
  students: "students",
  teachers: "teachers",
  classes: "classes",
  subjects: "subjects",
  sessions: "sessions",
  results: "results",
  settings: "settings", // single doc: settings/school
  rateLimits: "rateLimits", // one doc per admission number: { count, windowStart }
};

// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported, Analytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyC9jzDQ3P3c89K0IfvqcsuBbhTJgjPpxr8",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "quantiq221.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "quantiq221",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "quantiq221.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "956779895214",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:956779895214:web:aa4ce9abe9ad9a8e1e103f",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-259J82Q4SG",
};

// Initialize Firebase (guarding against multiple initializations in SSR / HMR)
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Analytics safely on client side
let analyticsInstance: Analytics | null = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analyticsInstance = getAnalytics(app);
    }
  });
}

export const analytics = analyticsInstance;

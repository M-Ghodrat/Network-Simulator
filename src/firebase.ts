import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCRoDhqGX1JRBn11HRv8vbCfAUrJ5zFa1k",
  authDomain: "gen-lang-client-0739423052.firebaseapp.com",
  projectId: "gen-lang-client-0739423052",
  storageBucket: "gen-lang-client-0739423052.firebasestorage.app",
  messagingSenderId: "79717399500",
  appId: "1:79717399500:web:6d53eaf9f94c62caf1fb69"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
// Use the custom database ID from the config
export const db = getFirestore(app, "ai-studio-ursaurbanresilie-61980384-3819-42c3-98f9-4cf877b5e76e");

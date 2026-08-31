import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAE_axkKym3wnwYXh_EgaKlHjhqMWXUIgM",
  authDomain: "quizmeter-7c71c.firebaseapp.com",
  projectId: "quizmeter-7c71c",
  storageBucket: "quizmeter-7c71c.firebasestorage.app",
  messagingSenderId: "117173198",
  appId: "1:117173198:web:29d4616a7a13bcd790999f",
  measurementId: "G-1P440D4YD0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export {db, auth};
export default app;



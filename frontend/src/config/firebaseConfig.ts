import { initializeApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

// Configuración para HWAgente (monitoreo de equipos) - projectId: devbac-42d14
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyCPsHnnh9aCsMG1W2ML5Vz-doZzQg1I__s",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "devbac-42d14.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "devbac-42d14",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "devbac-42d14.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "317393322844",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:317393322844:web:6215892f4779db5447f799",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-C5LLHPJYXP",
};

export const app: FirebaseApp = initializeApp(firebaseConfig);
export const db: Firestore = getFirestore(app);

// Nombre de la colección donde HWAgente escribe los datos (computadoras)
export const EQUIPMENT_COLLECTION = "computadoras";
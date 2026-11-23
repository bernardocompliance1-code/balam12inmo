// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBIDdMT6Babnx94SqQDGSQ54zTM3HgZHtU",
  authDomain: "balam12-58fc6.firebaseapp.com",
  projectId: "balam12-58fc6",
  storageBucket: "balam12-58fc6.firebasestorage.app",
  messagingSenderId: "239861001641",
  appId: "1:239861001641:web:2004d8c70ae06546d028b8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 2) Correo(s) de Google del administrador. Debe ser el mismo que pongas en firestore.rules.
export const ADMIN_EMAILS = ["bernardo.compliance1@gmail.com"];

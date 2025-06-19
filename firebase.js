// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBajwtgb8MymJNRqguUzXflQGCrpOhlBkw",
  authDomain: "cozyshare.firebaseapp.com",
  projectId: "cozyshare",
  storageBucket: "cozyshare.firebasestorage.app",
  messagingSenderId: "205791208710",
  appId: "1:205791208710:web:df23a111777b89ea77aa87"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };

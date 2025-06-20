// app.js
import { auth, db } from "./firebase.js";
import { setupBroadcaster } from "./broadcaster.js";
import { setupViewer } from "./viewer.js";
import { sendSignal, listenSignals, clearSignals } from "./utils/signaling.js";

// Firebase imports
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  runTransaction,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";

// Elements
const logoutBtn = document.getElementById("logoutBtn");
const loginSec = document.getElementById("login-section");
const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("login-status");
const roomSec = document.getElementById("room-section");
const roomIdInput = document.getElementById("roomIdInput");
const seatLimitInput = document.getElementById("seatLimitInput");
const createBtn = document.getElementById("createRoomBtn");
const joinBtn = document.getElementById("joinRoomBtn");
const broadcasterSec = document.getElementById("broadcaster-section");
const localVideo = document.getElementById("localVideo");
const stopBtn = document.getElementById("stopStreamBtn");
const viewerSec = document.getElementById("viewer-section");
const videoContain = document.getElementById("video-container");
const leaveBtn = document.getElementById("leaveRoomBtn");

let user, roomId, stopBroad, stopView;

// Mobile device detection
const isMobile = /Mobi|Android/i.test(navigator.userAgent);
if (isMobile) {
  createBtn.disabled = true;
  createBtn.title = "Screen sharing is not supported on mobile devices.";
}

// Logout
logoutBtn.onclick = async () => {
  await signOut(auth);
};

// Login/Register
loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  const em = document.getElementById("email").value.trim();
  const pw = document.getElementById("password").value;

  loginStatus.textContent = "Logging in...";
  loginStatus.className = "status";

  try {
    const cu = await signInWithEmailAndPassword(auth, em, pw);
    user = cu.user;
    loginStatus.textContent = "Login successful!";
    loginStatus.classList.add("success");
  } catch (loginErr) {
    try {
      const cu = await createUserWithEmailAndPassword(auth, em, pw);
      user = cu.user;
      loginStatus.textContent = "Registered and logged in successfully!";
      loginStatus.classList.add("success");
    } catch (regErr) {
      const msg = getFriendlyAuthError(regErr);
      loginStatus.textContent = msg;
      loginStatus.className = "status error";
      alert(msg);
    }
  }
});

// Auth state
onAuthStateChanged(auth, u => {
  user = u;
  if (user) {
    loginSec.style.display = "none";
    roomSec.style.display = "block";
    logoutBtn.style.display = "inline-block";
  } else {
    loginSec.style.display = "block";
    roomSec.style.display = "none";
    broadcasterSec.style.display = "none";
    viewerSec.style.display = "none";
    logoutBtn.style.display = "none";
  }
});

// Create room
createBtn.onclick = async () => {
  roomId = roomIdInput.value.trim();
  if (!roomId) return alert("Enter ID");

  const lim = parseInt(seatLimitInput.value, 10) || 50;

  const ref = doc(db, "rooms", roomId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    alert("Room ID already exists. Please choose another one.");
    return;
  }

  await setDoc(ref, {
    ownerId: user.uid,
    seatLimit: lim,
    currentViewers: 0,
    createdAt: new Date()
  });

  roomSec.style.display = "none";
  broadcasterSec.style.display = "block";

  document.getElementById("broadcaster-room-id").textContent = roomId;

  const roomRef = doc(db, "rooms", roomId);
  onSnapshot(roomRef, snap => {
    const data = snap.data();
    if (data && typeof data.currentViewers === "number") {
      document.getElementById("viewer-count").textContent = data.currentViewers;
    }
  });

  window.addEventListener("beforeunload", async () => {
    try {
      await clearSignals(roomId);
      await deleteDoc(doc(db, "rooms", roomId));
    } catch (e) {
      console.warn("Failed to clean up room on unload:", e);
    }
  });

  stopBroad = await setupBroadcaster(roomId, user.uid, localVideo);
};

// Join room
joinBtn.onclick = async () => {
  roomId = roomIdInput.value.trim();
  if (!roomId) return alert("Enter ID");

  const ref = doc(db, "rooms", roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return alert("Room not exist");

  try {
    await runTransaction(db, async tr => {
      const r = await tr.get(ref);
      if (r.data().currentViewers >= r.data().seatLimit) throw "Room full";
      tr.update(ref, { currentViewers: increment(1) });
    });

    roomSec.style.display = "none";
    viewerSec.style.display = "block";
    stopView = await setupViewer(roomId, user.uid, videoContain);
  } catch (e) {
    alert(e);
  }
};

stopBtn.onclick = async () => {
  if (stopBroad) {
    stopBroad();
    clearSignals(roomId);
    try {
      await deleteDoc(doc(db, "rooms", roomId));
    } catch (e) {
      console.error("Error deleting room:", e);
    }
  }
  broadcasterSec.style.display = "none";
  roomSec.style.display = "block";
};

leaveBtn.onclick = async () => {
  if (!roomId) return;
  await runTransaction(db, async tr => {
    const r = await tr.get(doc(db, "rooms", roomId));
    const current = r.data().currentViewers;
    if (current > 0) {
      tr.update(doc(db, "rooms", roomId), { currentViewers: increment(-1) });
    }
    if (current === 1) {
      await deleteDoc(doc(db, "rooms", roomId));
    }
  });
  if (stopView) stopView();
  viewerSec.style.display = "none";
  roomSec.style.display = "block";
};

function getFriendlyAuthError(error) {
  const code = error.code || "";
  switch (code) {
    case "auth/invalid-email":
      return "Invalid email format.";
    case "auth/email-already-in-use":
      return "This email is already registered, or the password is incorrect.";
    case "auth/user-not-found":
      return "User not found.";
    case "auth/wrong-password":
      return "Incorrect password.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/missing-password":
      return "Please enter a password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    default:
      return "Authentication error. " + (error.message || "");
  }
}

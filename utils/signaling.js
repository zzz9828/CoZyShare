// utils/signaling.js
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { app } from "../firebase.js";
const db = getFirestore(app);

export async function sendSignal(roomId, type, payload, from) {
  const col = collection(db, "rooms", roomId, "signals");
  await addDoc(col, { type, payload, from, timestamp: serverTimestamp() });
}

export function listenSignals(roomId, callback) {
  const col = collection(db, "rooms", roomId, "signals");
  const q = query(col, orderBy("timestamp"));
  return onSnapshot(q, snap => {
    snap.docChanges().forEach(ch => {
      if (ch.type === "added") callback(ch.doc.data());
    });
  });
}

export async function clearSignals(roomId) {
  const col = collection(db, "rooms", roomId, "signals");
  const snaps = await getDocs(col);
  for (const docSnap of snaps.docs) await deleteDoc(docSnap.ref);
}
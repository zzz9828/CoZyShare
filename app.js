// app.js
import { auth, db } from "./firebase.js";
import { setupBroadcaster } from "./broadcaster.js";
import { setupViewer } from "./viewer.js";
import { sendSignal, listenSignals, clearSignals } from "./utils/signaling.js";
import { doc, getDoc, setDoc, updateDoc, increment, runTransaction } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// Elements
const logoutBtn=document.getElementById("logoutBtn");
const loginSec=document.getElementById("login-section");
const loginForm=document.getElementById("loginForm");
const loginStatus=document.getElementById("login-status");
const roomSec=document.getElementById("room-section");
const roomIdInput=document.getElementById("roomIdInput");
const seatLimitInput=document.getElementById("seatLimitInput");
const createBtn=document.getElementById("createRoomBtn");
const joinBtn=document.getElementById("joinRoomBtn");
const broadcasterSec=document.getElementById("broadcaster-section");
const localVideo=document.getElementById("localVideo");
const stopBtn=document.getElementById("stopStreamBtn");
const viewerSec=document.getElementById("viewer-section");
const videoContain=document.getElementById("video-container");
const leaveBtn=document.getElementById("leaveRoomBtn");

let user, roomId, stopBroad, stopView;

// Logout
logoutBtn.onclick=async()=>{
  await signOut(auth);
};

// Login/Register
loginForm.addEventListener("submit",async e=>{
  e.preventDefault();
  const em=document.getElementById("email").value;
  const pw=document.getElementById("password").value;
  try{ const cu=await signInWithEmailAndPassword(auth,em,pw); user=cu.user; }
  catch{ const cu=await createUserWithEmailAndPassword(auth,em,pw); user=cu.user; }
});

// Auth state
onAuthStateChanged(auth,u=>{
  user=u;
  if(user){
    loginSec.style.display="none"; roomSec.style.display="block"; logoutBtn.style.display="inline-block";
  } else {
    loginSec.style.display="block"; roomSec.style.display="none"; broadcasterSec.style.display="none"; viewerSec.style.display="none"; logoutBtn.style.display="none";
  }
});

// Create room
createBtn.onclick = async () => {
  roomId = roomIdInput.value.trim();
  if (!roomId) return alert("Enter ID");

  // 获取并校验 seatLimitInput
  const seatLimitEl = document.getElementById("seatLimitInput");
  const lim = seatLimitEl ? (parseInt(seatLimitEl.value, 10) || 50) : 50;

  // 唯一性检查
  const ref = doc(db, "rooms", roomId);
  const snap = await getDoc(ref);
  if (snap.exists()) return alert("Room ID exists");

  // 创建房间文档
  await setDoc(ref, {
    ownerId: user.uid,
    seatLimit: lim,
    currentViewers: 0,
    createdAt: new Date()
  });

  // 切换到房主界面
  roomSec.style.display = "none";
  broadcasterSec.style.display = "block";
  stopBroad = await setupBroadcaster(roomId, user.uid, localVideo);
};


// Join room
joinBtn.onclick=async()=>{
  roomId=roomIdInput.value.trim(); if(!roomId) return alert("Enter ID");
  const ref=doc(db,"rooms",roomId); const snap=await getDoc(ref);
  if(!snap.exists()) return alert("Room not exist");
  try{ await runTransaction(db,async tr=>{
      const r=await tr.get(ref);
      if(r.data().currentViewers>=r.data().seatLimit) throw"Room full";
      tr.update(ref,{currentViewers:increment(1)});
    });
    roomSec.style.display="none"; viewerSec.style.display="block";
    stopView=await setupViewer(roomId,user.uid,videoContain);
  }catch(e){alert(e);}
};

// Stop share
stopBtn.onclick = () => {
  if (stopBroad) {
    stopBroad();
    clearSignals(roomId);
    // **新增：删除 rooms/{roomId} 文档，释放 ID**
    deleteDoc(doc(db, "rooms", roomId));
  }
  broadcasterSec.style.display = "none";
  roomSec.style.display = "block";
};

// Leave viewer
leaveBtn.onclick=async()=>{
  if(!roomId) return;
  await runTransaction(db,async tr=>{
    const r=await tr.get(doc(db,"rooms",roomId));
    if(r.data().currentViewers>0) tr.update(doc(db,"rooms",roomId),{currentViewers:increment(-1)});
  });
  if(stopView) stopView();
  viewerSec.style.display="none"; roomSec.style.display="block";
};
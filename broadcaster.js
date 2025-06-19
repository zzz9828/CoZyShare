// broadcaster.js
import { sendSignal, listenSignals } from "./utils/signaling.js";

export async function setupBroadcaster(roomId, userId, videoEl) {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  videoEl.srcObject = stream;
  const pc = new RTCPeerConnection({ iceServers:[{urls:"stun:stun.l.google.com:19302"}] });
  stream.getTracks().forEach(track=>pc.addTrack(track,stream));
  pc.onicecandidate=e=>{ if(e.candidate) sendSignal(roomId,"ice",e.candidate.toJSON(),userId); };
  const offer=await pc.createOffer(); await pc.setLocalDescription(offer);
  await sendSignal(roomId,"offer",offer.toJSON(),userId);
  const unsub = listenSignals(roomId,async data=>{
    if(data.from===userId) return;
    if(data.type==="answer") await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
    else if(data.type==="ice") await pc.addIceCandidate(data.payload);
  });
  return ()=>{ unsub(); pc.close(); stream.getTracks().forEach(t=>t.stop()); };
}
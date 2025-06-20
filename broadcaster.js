// broadcaster.js
import { sendSignal, listenSignals } from "./utils/signaling.js";

export async function setupBroadcaster(roomId, userId, videoEl) {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  videoEl.srcObject = stream;
  videoEl.muted = true;
  videoEl.autoplay = true;
  videoEl.playsInline = true;

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  pc.onicecandidate = e => {
    if (e.candidate) {
      sendSignal(roomId, "ice", e.candidate.toJSON(), userId);
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // ✅ 等 ICE 完整之后再发送 offer
  await new Promise(resolve => {
    if (pc.iceGatheringState === "complete") {
      resolve();
    } else {
      const check = () => {
        if (pc.iceGatheringState === "complete") {
          pc.removeEventListener("icegatheringstatechange", check);
          resolve();
        }
      };
      pc.addEventListener("icegatheringstatechange", check);
    }
  });

  await sendSignal(roomId, "offer", pc.localDescription, userId);

  const unsub = listenSignals(roomId, async data => {
    if (data.from === userId) return;

    if (data.type === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
    } else if (data.type === "ice") {
      try {
        await pc.addIceCandidate(data.payload);
      } catch (err) {
        console.warn("Error adding ICE candidate:", err);
      }
    }
  });

  return () => {
    unsub();
    pc.close();
    stream.getTracks().forEach(t => t.stop());
  };
}


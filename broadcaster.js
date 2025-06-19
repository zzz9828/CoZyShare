// broadcaster.js
import { sendSignal, listenSignals } from "./utils/signaling.js";

export async function setupBroadcaster(roomId, userId, videoEl) {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  videoEl.srcObject = stream;

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  // 添加媒体流 track
  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  // ICE Candidate 处理
  pc.onicecandidate = e => {
    if (e.candidate) {
      sendSignal(roomId, "ice", e.candidate.toJSON(), userId);
    }
  };

  // 创建 offer 并设置本地描述
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // ❗关键：直接传 offer，不要 .toJSON()
  await sendSignal(roomId, "offer", offer, userId);

  // 接收 viewer 返回的 answer
  const unsub = listenSignals(roomId, async data => {
    if (data.from === userId) return;

    if (data.type === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
    } else if (data.type === "ice") {
      try {
        await pc.addIceCandidate(data.payload);
      } catch (err) {
        console.warn("Error adding remote ICE candidate:", err);
      }
    }
  });

  // 返回清理函数
  return () => {
    unsub();
    pc.close();
    stream.getTracks().forEach(t => t.stop());
  };
}

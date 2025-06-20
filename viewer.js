// viewer.js
import { sendSignal, listenSignals } from "./utils/signaling.js";

export async function setupViewer(roomId, userId, container) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  // 📌 先订阅信令，避免抢在 offer 前设置 ICE
  const unsub = listenSignals(roomId, async (data) => {
    if (data.from === userId) return;

    if (data.type === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // ✅ 不需要 toJSON
      await sendSignal(roomId, "answer", answer, userId);
    } else if (data.type === "ice") {
      try {
        await pc.addIceCandidate(data.payload);
      } catch (e) {
        console.warn("Error adding remote ICE candidate:", e);
      }
    }
  });

  pc.onicecandidate = e => {
    if (e.candidate) {
      sendSignal(roomId, "ice", e.candidate.toJSON(), userId);
    }
  };

  pc.ontrack = (event) => {
    const stream = event.streams[0];
    container.innerHTML = "";

    const video = document.createElement("video");
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;

    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";

    const watermark = document.createElement("div");
    watermark.className = "watermark";
    watermark.textContent = `Room: ${roomId}`;

    wrapper.appendChild(video);
    wrapper.appendChild(watermark);

    container.appendChild(wrapper);
  };

  return () => {
    unsub();
    pc.close();
    container.innerHTML = "";
  };
}

// viewer.js
import { sendSignal, listenSignals } from "./utils/signaling.js";

export async function setupViewer(roomId, userId, container) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  let hasRemoteDesc = false;
  const pendingCandidates = [];

  const unsub = listenSignals(roomId, async (data) => {
    if (data.from === userId) return;

    if (data.type === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
      hasRemoteDesc = true;

      // 🧊 添加所有之前缓存的 ICE 候选
      for (const candidate of pendingCandidates) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          console.warn("Error applying buffered ICE:", e);
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal(roomId, "answer", answer, userId);
    }

    else if (data.type === "ice") {
      if (!hasRemoteDesc) {
        pendingCandidates.push(data.payload); // ⏳ 缓存 ICE
      } else {
        try {
          await pc.addIceCandidate(data.payload);
        } catch (e) {
          console.warn("Error adding remote ICE candidate:", e);
        }
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

// viewer.js
import { sendSignal, listenSignals } from "./utils/signaling.js";

export async function setupViewer(roomId, userId, container) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  // 监听远端媒体流
  pc.ontrack = (event) => {
    const remoteStream = event.streams[0];
    container.innerHTML = "";

    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = remoteStream;

    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";

    const watermark = document.createElement("div");
    watermark.className = "watermark";
    watermark.textContent = `Room: ${roomId}`;

    wrapper.appendChild(video);
    wrapper.appendChild(watermark);
    container.appendChild(wrapper);
  };

  const remoteCandidates = [];

  // 信令处理
  const unsub = listenSignals(roomId, async (data) => {
    if (data.from === userId) return;

    if (data.type === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // ✅ 注意：不要使用 toJSON()
      await sendSignal(roomId, "answer", answer, userId);

      // 添加缓存的 ICE candidate
      for (const c of remoteCandidates) {
        try {
          await pc.addIceCandidate(c);
        } catch (e) {
          console.warn("Error adding cached ICE candidate:", e);
        }
      }
      remoteCandidates.length = 0;

    } else if (data.type === "ice") {
      const candidate = new RTCIceCandidate(data.payload);
      if (pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          console.warn("Error adding remote ICE candidate:", e);
        }
      } else {
        remoteCandidates.push(candidate);
      }
    }
  });

  // 本地 ICE 发送给 host
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal(roomId, "ice", event.candidate, userId);
    }
  };

  // 清理函数
  return () => {
    unsub();
    pc.close();
    container.innerHTML = "";
  };
}

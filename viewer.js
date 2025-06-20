// viewer.js
import { sendSignal, listenSignals } from "./utils/signaling.js";

export async function setupViewer(roomId, userId, container) {
  console.log("[Viewer] setupViewer start:", roomId, userId);

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  let hasRemoteDesc = false;
  const pendingCandidates = [];

  const unsub = listenSignals(roomId, async (data) => {
    console.log("[Viewer] Received signal:", data);

    if (data.from === userId) return;

    if (data.type === "offer") {
      console.log("[Viewer] Received offer");

      await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
      hasRemoteDesc = true;
      console.log("[Viewer] Set remote description");

      // 🧊 添加所有之前缓存的 ICE 候选
      for (const candidate of pendingCandidates) {
        try {
          await pc.addIceCandidate(candidate);
          console.log("[Viewer] Applied buffered ICE candidate:", candidate);
        } catch (e) {
          console.warn("[Viewer] Error applying buffered ICE:", e);
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal(roomId, "answer", answer, userId);
      console.log("[Viewer] Sent answer");
    }

    else if (data.type === "ice") {
      if (!hasRemoteDesc) {
        pendingCandidates.push(data.payload);
        console.log("[Viewer] ICE candidate buffered:", data.payload);
      } else {
        try {
          await pc.addIceCandidate(data.payload);
          console.log("[Viewer] ICE candidate added:", data.payload);
        } catch (e) {
          console.warn("[Viewer] Error adding remote ICE candidate:", e);
        }
      }
    }
  });

  pc.onicecandidate = e => {
    if (e.candidate) {
      sendSignal(roomId, "ice", e.candidate.toJSON(), userId);
      console.log("[Viewer] Sent local ICE candidate");
    }
  };

  pc.ontrack = (event) => {
    console.log("[Viewer] ontrack triggered, streams:", event.streams);

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

    console.log("[Viewer] Video element attached to container");
  };

  return () => {
    console.log("[Viewer] Cleanup triggered");
    unsub();
    pc.close();
    container.innerHTML = "";
  };
}

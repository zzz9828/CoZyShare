// viewer.js
import { sendSignal, listenSignals } from "./utils/signaling.js";

export async function setupViewer(roomId, userId, container) {
  console.log("[Viewer] setupViewer start:", roomId, userId);

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  // 缓存远端 ICE candidate，直到远端描述设置完成
  const pendingCandidates = [];
  let hasRemoteDesc = false;

  // 订阅信令
  const unsub = listenSignals(roomId, async (data) => {
    console.log("[Viewer] Received signal:", data);

    if (data.from === userId) {
      console.log("[Viewer] Ignoring own signal");
      return;
    }

    if (data.type === "offer") {
      console.log("[Viewer] Offer received, setting remote description...");
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
        hasRemoteDesc = true;
        console.log("[Viewer] Remote description set successfully");

        // 处理缓存的 ICE candidate
        for (const candidate of pendingCandidates) {
          try {
            await pc.addIceCandidate(candidate);
            console.log("[Viewer] Added buffered ICE candidate:", candidate);
          } catch (e) {
            console.warn("[Viewer] Error adding buffered ICE candidate:", e);
          }
        }
        pendingCandidates.length = 0; // 清空缓存

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log("[Viewer] Created and set local answer");

        await sendSignal(roomId, "answer", answer, userId);
        console.log("[Viewer] Sent answer signal");
      } catch (err) {
        console.error("[Viewer] Error handling offer:", err);
      }

    } else if (data.type === "ice") {
      console.log("[Viewer] ICE candidate received");
      if (hasRemoteDesc) {
        try {
          await pc.addIceCandidate(data.payload);
          console.log("[Viewer] Added ICE candidate:", data.payload);
        } catch (e) {
          console.warn("[Viewer] Error adding ICE candidate:", e);
        }
      } else {
        console.log("[Viewer] Remote description not set yet, buffering ICE candidate");
        pendingCandidates.push(data.payload);
      }
    }
  });

  pc.onicecandidate = e => {
    if (e.candidate) {
      console.log("[Viewer] Sending ICE candidate:", e.candidate);
      sendSignal(roomId, "ice", e.candidate.toJSON(), userId);
    }
  };

  pc.ontrack = (event) => {
    console.log("[Viewer] ontrack event received, attaching video stream");
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

  pc.onconnectionstatechange = () => {
    console.log("[Viewer] Connection state changed:", pc.connectionState);
  };

  return () => {
    console.log("[Viewer] Cleaning up");
    unsub();
    pc.close();
    container.innerHTML = "";
  };
}

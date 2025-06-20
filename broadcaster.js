// broadcaster.js
import { sendSignal, listenSignals } from "./utils/signaling.js";

export async function setupBroadcaster(roomId, userId, videoEl) {
  // 1. 获取屏幕流
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });

  // 2. 设置本地 video 元素属性
  videoEl.srcObject = stream;
  videoEl.muted = true;
  videoEl.autoplay = true;
  videoEl.playsInline = true;

  // 3. 创建 PeerConnection
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  // 4. 添加轨道到 PeerConnection
  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  // 5. 监听本地 ICE 候选
  pc.onicecandidate = e => {
    if (e.candidate) {
      sendSignal(roomId, "ice", e.candidate.toJSON(), userId);
    }
  };

  // 6. 创建并设置本地 offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // 7. 等待 ICE gathering 完成
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

  // 8. 发送完整 offer
  await sendSignal(roomId, "offer", pc.localDescription, userId);

  // 9. 监听 viewer 返回的信令
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

  // 10. 返回停止函数
  return () => {
    unsub();
    pc.close();
    stream.getTracks().forEach(t => t.stop());
  };
}

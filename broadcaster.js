// broadcaster.js
import { sendSignal, listenSignals } from "./utils/signaling.js";

export async function setupBroadcaster(roomId, userId, videoEl) {
  // 获取屏幕共享流
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  videoEl.srcObject = stream;

  // 创建 RTCPeerConnection
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  // 将流中的所有轨道添加到 pc
  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  // 本地 ICE candidate 产生时发送给 viewer
  pc.onicecandidate = e => {
    if (e.candidate) sendSignal(roomId, "ice", e.candidate.toJSON(), userId);
  };

  // 创建 offer 并设置本地描述
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // 发送 offer 给 viewer
  await sendSignal(roomId, "offer", offer.toJSON(), userId);

  // 缓存远端 ICE candidate
  const remoteCandidates = [];

  // 监听 viewer 发来的信令
  const unsub = listenSignals(roomId, async data => {
    if (data.from === userId) return;

    if (data.type === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.payload));

      // 设置远端描述后，添加缓存的 ICE candidates
      for (const candidate of remoteCandidates) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          console.warn("Error adding cached ICE candidate:", e);
        }
      }
      remoteCandidates.length = 0; // 清空缓存
    } else if (data.type === "ice") {
      const candidate = new RTCIceCandidate(data.payload);

      // 远端描述已经设置，直接添加
      if (pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          console.warn("Error adding remote ICE candidate:", e);
        }
      } else {
        // 远端描述未设置，缓存起来
        remoteCandidates.push(candidate);
      }
    }
  });

  // 返回停止函数，用于关闭连接和停止共享流
  return () => {
    unsub();
    pc.close();
    stream.getTracks().forEach(t => t.stop());
  };
}

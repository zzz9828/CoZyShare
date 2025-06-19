// broadcaster.js
import { sendSignal, listenSignals } from "./utils/signaling.js";

export async function setupBroadcaster(roomId, userId, videoEl) {
  // 获取屏幕共享流
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  videoEl.srcObject = stream;

  // 创建 RTCPeerConnection
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

  // 将流的轨道添加到连接
  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  // 监听 ICE candidate，发送给 viewer
  pc.onicecandidate = e => {
    if (e.candidate) sendSignal(roomId, "ice", e.candidate.toJSON(), userId);
  };

  // 创建 offer 并设置本地描述
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // 发送 offer 使用 pc.localDescription.toJSON()
  await sendSignal(roomId, "offer", pc.localDescription.toJSON(), userId);

  // 监听来自 viewer 的信令
  const unsub = listenSignals(roomId, async data => {
    if (data.from === userId) return;
    if (data.type === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
    } else if (data.type === "ice") {
      try {
        await pc.addIceCandidate(data.payload);
      } catch (e) {
        console.warn("Error adding remote ICE candidate:", e);
      }
    }
  });

  // 返回一个函数，用于停止共享并关闭连接
  return () => {
    unsub();
    pc.close();
    stream.getTracks().forEach(t => t.stop());
  };
}

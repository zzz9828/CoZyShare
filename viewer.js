// viewer.js

import { sendSignal, listenSignals } from "./utils/signaling.js";

export async function setupViewer(roomId, userId, container) {
  // 1. 创建 RTCPeerConnection 实例
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
      // 可添加 TURN 服务器配置
    ]
  });

  // ICE candidate 缓存队列，等待 remoteDescription 设置好后再添加
  const iceQueue = [];
  let remoteDescSet = false;

  // 2. 先订阅信令，这样能收到房主已发送的 offer/ice
  const unsub = listenSignals(roomId, async (data) => {
    if (data.from === userId) return; // 忽略自己发出的

    if (data.type === "offer") {
      // 收到房主的 offer -> 设置远端描述并创建 answer
      await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
      remoteDescSet = true;

      // 处理之前缓存的 ICE candidate
      for (const c of iceQueue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch (e) {
          console.warn("Error adding remote ICE candidate from queue:", e);
        }
      }
      iceQueue.length = 0; // 清空队列

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      // 发送 answer 回房主
      await sendSignal(roomId, "answer", answer.toJSON(), userId);

    } else if (data.type === "ice") {
      // 收到房主的 ICE candidate
      if (remoteDescSet) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.payload));
        } catch (e) {
          console.warn("Error adding remote ICE candidate:", e);
        }
      } else {
        // remoteDescription 未设置，先缓存 ICE candidate
        iceQueue.push(data.payload);
      }
    }
  });

  // 3. 当本地有 ICE candidate 时，发送给房主
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal(roomId, "ice", event.candidate.toJSON(), userId);
    }
  };

  // 4. 收到远端媒体流时，渲染到页面并添加水印
  pc.ontrack = (event) => {
    const remoteStream = event.streams[0];

    // 清空旧内容
    container.innerHTML = "";

    // 创建 video 元素
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = remoteStream;

    // 包装 video + 水印
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";

    const watermark = document.createElement("div");
    watermark.className = "watermark";
    watermark.textContent = `Room: ${roomId}`;

    wrapper.appendChild(video);
    wrapper.appendChild(watermark);

    container.appendChild(wrapper);
  };

  // 返回一个函数，用于清理：停止连接与订阅，清空界面
  return () => {
    unsub();
    pc.close();
    container.innerHTML = "";
  };
}

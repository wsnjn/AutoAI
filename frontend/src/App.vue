<script setup>
import { ref, onMounted } from 'vue'

const message = ref('')
const response = ref('')
const inputName = ref('')

// 获取后端消息
const fetchMessage = async () => {
  try {
    const res = await fetch('http://39.108.142.250:3000/api/message')
    const data = await res.json()
    message.value = data.message
  } catch (error) {
    message.value = '无法连接到后端服务器'
  }
}

// 发送数据到后端
const sendData = async () => {
  try {
    const res = await fetch('http://39.108.142.250:3000/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: inputName.value })
    })
    const data = await res.json()
    response.value = data.message
  } catch (error) {
    response.value = '发送数据失败'
  }
}

// 组件挂载时获取消息
onMounted(() => {
  fetchMessage()
})
</script>

<template>
  <div id="app">
    <router-view />
    <!-- 全局3D模型助手 -->
    <ThreeModelViewer />
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: #f5f5f5;
  overflow-x: hidden;
}

#app {
  min-height: 100vh;
  position: relative;
}

/* 全局3D模型样式 */
.three-model-viewer {
  position: fixed;
  z-index: 1000;
  pointer-events: auto;
}

/* 全局滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 全局按钮样式 */
button {
  cursor: pointer;
  border: none;
  outline: none;
  transition: all 0.3s ease;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* 全局输入框样式 */
input, textarea, select {
  font-family: inherit;
  outline: none;
  transition: all 0.3s ease;
}

/* 全局链接样式 */
a {
  text-decoration: none;
  color: inherit;
}

/* 全局动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  animation: fadeIn 0.5s ease-out;
}

/* 响应式设置 */
@media (max-width: 768px) {
  .container {
    padding: 10px;
  }
}

/* 全局加载动画 */
.loading {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 全局错误样式 */
.error {
  color: #d32f2f;
  background: #ffebee;
  border: 1px solid #ffcdd2;
  border-radius: 4px;
  padding: 10px;
  margin: 10px 0;
}

.success {
  color: #2e7d32;
  background: #e8f5e8;
  border: 1px solid #c8e6c9;
  border-radius: 4px;
  padding: 10px;
  margin: 10px 0;
}

.warning {
  color: #f57c00;
  background: #fff3e0;
  border: 1px solid #ffcc02;
  border-radius: 4px;
  padding: 10px;
  margin: 10px 0;
}
</style>

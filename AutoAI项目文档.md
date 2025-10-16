# AutoAI智能代码助手项目

## 项目概述

AutoAI是一个基于Vue.js 3 + Node.js + MySQL的智能代码助手平台，采用云开发模式，支持多用户协作开发。这个项目最大的特色就是集成了AI代码生成、3D模型交互、团队协作和好友聊天等多种功能于一体。

![AutoAI项目架构](C:\Users\xm281\AppData\Local\Temp\AutoAI_Architecture.png)

### 技术栈说明

前端使用Vue 3 + Vue Router 4 + 纯CSS + Three.js + Web Speech API，后端采用Node.js + Express + MySQL 8.0 + mysql2/promise，AI集成使用DeepSeek API。整个项目采用CDN方式部署，避免了复杂的ES6模块导入问题。

### 项目初始化

首先需要创建项目文件夹，建议命名为AutoAI：

~~~html
mkdir AutoAI
cd AutoAI
~~~

### 安装Node.js环境

确保系统已安装Node.js，建议版本18以上：

~~~html
node -v //查看版本号，验证是否安装
npm -v //查看npm版本
~~~

## 项目结构搭建

### 前端项目创建

在AutoAI文件夹下创建前端项目：

~~~html
mkdir frontend
cd frontend
npm init vue@latest .
~~~

#### 选择配置选项

创建Vue项目时建议勾选以下选项：
- ✅ TypeScript
- ✅ Router
- ✅ Pinia
- ✅ ESLint

#### 安装依赖

~~~html
npm install
npm install three
npm install axios
npm install element-plus
~~~

### 后端项目创建

在AutoAI文件夹下创建后端项目：

~~~html
mkdir backend
cd backend
npm init -y
~~~

#### 安装后端依赖

~~~html
npm install express mysql2 cors dotenv
npm install -D nodemon
~~~

## 数据库配置

### MySQL数据库设置

AutoAI使用MySQL 8.0作为数据库，支持动态表创建。数据库配置在`backend/config/database.js`文件中：

~~~html
// backend/config/database.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '39.108.142.250',  // 云数据库地址
  port: 3306,
  user: 'root',
  password: 'your_password',
  database: 'autoai',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
~~~

### 数据库表结构

项目使用动态表创建机制，每个项目都会创建对应的数据表：

~~~html
-- 项目主表
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  project_type VARCHAR(50),
  created_by VARCHAR(100),
  created_by_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 项目成员表
CREATE TABLE IF NOT EXISTS project_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(50),
  user_id INT,
  username VARCHAR(100),
  role ENUM('owner', 'member') DEFAULT 'member',
  status ENUM('active', 'inactive', 'removed') DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
~~~

## 核心功能模块

### AI代码生成功能

AutoAI的核心功能就是AI代码生成，支持Vue、HTML、JavaScript等多种项目类型。AI会根据用户的需求自动生成完整的项目代码：

~~~html
// backend/services/aiService.js
const generateCode = async (prompt, projectType) => {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-coder',
      messages: [
        {
          role: 'system',
          content: `你是一个专业的${projectType}开发助手，请根据用户需求生成完整的项目代码。`
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });
  
  return await response.json();
};
~~~

### 3D模型交互功能

项目集成了Three.js 3D模型展示，用户可以与3D模型进行交互：

~~~html
// frontend/src/components/ThreeModelViewer.vue
<template>
  <div ref="modelContainer" class="model-container"></div>
</template>

<script>
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export default {
  name: 'ThreeModelViewer',
  data() {
    return {
      mixer: null,
      animationFrameId: null,
      renderer: null,
      controls: null,
      // 语音识别相关
      voiceCommands: {
        "返回登录页面": this.navigateToLogin,
        "跳转到注册页面": this.navigateToRegister,
        "查看历史记录": this.navigateToChatHistory,
        "返回首页": this.navigateToHome
      }
    };
  }
};
</script>
~~~

### 团队协作功能

AutoAI支持多用户团队协作，项目创建者可以邀请其他用户加入项目，并进行成员管理：

~~~html
// frontend/src/views/Team.vue
<template>
  <div class="team-container">
    <h2>团队管理</h2>
    
    <!-- 我的项目列表 -->
    <div class="projects-section">
      <h3>我创建的项目</h3>
      <div v-for="project in myProjects" :key="project.id" class="project-item">
        <div class="project-header" @click="toggleProjectExpand(project.id)">
          <span class="project-name">{{ project.name }}</span>
          <span class="member-count">{{ project.memberCount }} 个成员</span>
          <span class="expand-icon">{{ project.expanded ? '▼' : '▶' }}</span>
        </div>
        
        <!-- 项目成员管理 -->
        <div v-if="project.expanded" class="members-section">
          <div class="member-list">
            <div v-for="member in project.members" :key="member.id" class="member-item">
              <span class="member-name">{{ member.username }}</span>
              <span class="member-role">{{ getRoleText(member.role) }}</span>
              <span class="member-status">{{ getStatusText(member.status) }}</span>
              <div class="member-actions">
                <button @click="removeMember(project.id, member.user_id)">移除</button>
                <button @click="toggleBanMember(project.id, member.user_id)">
                  {{ member.status === 'active' ? '拉黑' : '解封' }}
                </button>
              </div>
            </div>
          </div>
          
          <!-- 邀请新成员 -->
          <div class="invite-section">
            <button @click="openInviteModal(project.id)">邀请成员</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
~~~

### 好友聊天功能

项目还集成了好友系统，用户可以添加好友并进行实时聊天：

~~~html
// frontend/src/views/Friends.vue
<template>
  <div class="friends-container">
    <div class="friends-sidebar">
      <!-- 好友列表 -->
      <div class="friends-list">
        <h3>好友列表</h3>
        <div v-for="friend in friends" :key="friend.id" 
             :class="['friend-item', { active: selectedFriend?.id === friend.id }]"
             @click="openChat(friend)">
          <div class="friend-avatar">{{ friend.username.charAt(0) }}</div>
          <div class="friend-info">
            <div class="friend-name">{{ friend.username }}</div>
            <div class="friend-status">在线</div>
          </div>
        </div>
      </div>
      
      <!-- 待处理的好友请求 -->
      <div class="pending-requests">
        <h3>好友请求</h3>
        <div v-for="request in pendingRequests" :key="request.id" class="request-item">
          <div class="request-info">
            <span>{{ request.username }} 请求添加你为好友</span>
          </div>
          <div class="request-actions">
            <button @click="respondToRequest(request.user_id, 'accept')">接受</button>
            <button @click="respondToRequest(request.user_id, 'reject')">拒绝</button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 聊天窗口 -->
    <div class="chat-window">
      <div v-if="selectedFriend" class="chat-header">
        <h3>{{ selectedFriend.username }}</h3>
      </div>
      
      <div class="chat-messages" ref="chatMessages">
        <div v-for="message in chatMessages" :key="message.id" 
             :class="['message', message.sender_id === currentUser.id ? 'sent' : 'received']">
          <div class="message-content">{{ message.message }}</div>
          <div class="message-time">{{ formatDate(message.created_at) }}</div>
        </div>
      </div>
      
      <div class="chat-input">
        <input v-model="newMessage" @keyup.enter="sendMessage" placeholder="输入消息...">
        <button @click="sendMessage">发送</button>
      </div>
    </div>
  </div>
</template>
~~~

## 项目启动和部署

### 本地开发环境启动

#### 启动后端服务

~~~html
cd backend
npm start
# 或者使用开发模式
npm run dev
~~~

后端服务默认运行在3000端口，确保MySQL数据库已启动并配置正确。

#### 启动前端服务

~~~html
cd frontend
npm run dev
~~~

前端服务默认运行在5173端口，会自动打开浏览器访问。

### 生产环境部署

#### 前端打包

~~~html
cd frontend
npm run build
~~~

打包后的文件会生成在`dist`文件夹中，可以直接部署到任何静态文件服务器。

#### 后端部署

~~~html
cd backend
# 安装PM2进程管理器
npm install -g pm2

# 启动后端服务
pm2 start index.js --name "autoai-backend"

# 查看服务状态
pm2 status

# 查看日志
pm2 logs autoai-backend
~~~

### 环境变量配置

创建`.env`文件配置环境变量：

~~~html
# backend/.env
DB_HOST=39.108.142.250
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=autoai

DEEPSEEK_API_KEY=your_deepseek_api_key
JWT_SECRET=your_jwt_secret

PORT=3000
NODE_ENV=production
~~~

## 项目特色功能

### 智能代码预览

AutoAI支持多种文件类型的实时预览，包括Vue组件、HTML页面、JavaScript文件等：

~~~html
// frontend/src/components/ProjectPreview.vue
<template>
  <div class="preview-container">
    <div class="preview-header">
      <h3>{{ selectedFile?.file_name || '选择文件预览' }}</h3>
      <div class="preview-actions">
        <button @click="refreshPreview">刷新</button>
        <button @click="downloadFile">下载</button>
      </div>
    </div>
    
    <div class="preview-content">
      <iframe v-if="previewUrl" 
              :src="previewUrl" 
              class="preview-iframe"
              @load="onPreviewLoad">
      </iframe>
      
      <div v-else class="no-preview">
        <p>请选择一个文件进行预览</p>
      </div>
    </div>
  </div>
</template>
~~~

### 语音交互功能

项目集成了Web Speech API，用户可以通过语音与3D模型进行交互：

~~~html
// 语音识别实现
startSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    alert("你的浏览器不支持语音识别");
    return Promise.reject("Speech recognition not supported");
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'zh-CN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  return new Promise((resolve, reject) => {
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log("🗣️ 你说的是:", transcript);
      
      // 检查预设回答
      if (this.checkPresetAnswers(transcript)) {
        console.log("检测到预设答案，已执行对应操作");
      }
      // 检查快捷指令
      else if (this.checkAndExecuteVoiceCommands(transcript)) {
        console.log("检测到快捷指令，已执行对应操作");
      }
      // 发送到父组件处理
      else {
        this.$emit('speech-recognized', transcript);
      }
      
      resolve(transcript);
    };
    
    recognition.start();
  });
}
~~~

## 项目总结

### 技术亮点

AutoAI项目集成了多种前沿技术，实现了以下核心功能：

1. **AI代码生成**：基于DeepSeek API的智能代码生成，支持多种项目类型
2. **3D模型交互**：使用Three.js实现3D模型展示和语音交互
3. **团队协作**：完整的项目成员管理和权限控制系统
4. **好友聊天**：实时聊天功能和好友关系管理
5. **智能预览**：支持多种文件类型的实时预览功能

### 项目架构优势

- **前后端分离**：Vue 3 + Node.js的现代化架构
- **数据库设计**：MySQL动态表创建，支持多项目隔离
- **CDN部署**：避免ES6模块导入问题，提高兼容性
- **语音交互**：Web Speech API集成，提升用户体验

### 开发心得

在开发AutoAI项目过程中，我们遇到了很多技术挑战：

1. **Vue组件预览问题**：最初AI生成的Vue项目包含配置文件，导致预览失败。通过修改AI提示词，只生成Vue组件文件，解决了这个问题。

2. **文件删除冲突**：多个组件同时触发删除请求导致400错误。通过实现全局删除锁机制，避免了重复删除请求。

3. **好友关系双向性**：初始实现的好友关系是单向的，通过修正数据库查询逻辑，实现了真正的双向好友关系。

4. **语音识别集成**：3D模型与语音识别的结合需要处理多种交互场景，通过预设回答和快捷指令的机制，提供了丰富的交互体验。

### 未来规划

AutoAI项目还有很大的发展空间，未来计划实现以下功能：

1. **更多AI模型支持**：集成更多AI服务提供商，提供更丰富的代码生成选项
2. **实时协作编辑**：实现多用户同时编辑项目的功能
3. **项目模板库**：建立丰富的项目模板库，提高开发效率
4. **移动端适配**：开发移动端应用，支持随时随地访问项目
5. **插件系统**：开发插件系统，支持第三方功能扩展

### 结语

AutoAI项目是一个集成了AI、3D、协作等多种技术的综合性平台，它不仅展示了现代Web开发的技术实力，更重要的是为用户提供了一个智能化的开发环境。通过持续的技术创新和功能完善，AutoAI将成为开发者们不可或缺的智能助手。

![项目完成](C:\Users\xm281\AppData\Local\Temp\Project_Complete.png)

**项目地址**：https://github.com/your-username/AutoAI  
**在线演示**：https://autoai-demo.com  
**技术支持**：support@autoai.com

### 智能生成、部署与实时预览一体化云开发平台

---

## 前言

在中国 AI 应用生态中，个人开发者能够轻松“使用”大模型（例如调用 DeepSeek API、ChatGPT、通义千问接口），

但几乎没有系统化的资料教人如何**从零实现一个 AI 驱动的开发工具**。

AutoAI 项目的初衷，就是想回答一个问题：

> “一个人，能否从零实现一款类似 Cursor / Replit 的 AI 智能云开发平台？”
> 

我决定亲自构建一个可运行、可视化、可交互的 AI 云端开发系统——

让 AI 能够自动生成、修改、部署完整的前后端项目。

它不仅是一个工具，更是一次系统性探索：

从 **架构设计 → 文件系统虚拟化 → 实时渲染与 AI 协作** 的全过程。

---

## 第一章：项目构思与理念

### 1.1 背景

传统的 AI 项目仅仅停留在「问答层」：

用户输入问题，模型输出答案。

而在实际开发中，我们需要的是**让 AI 直接操作项目文件、修改代码、部署项目**。

因此，我想实现一个系统，它能做到：

- 理解自然语言指令；
- 自动创建文件、编写代码；
- 即时在网页中可视化预览；
- 支持实时协作与项目保存。

这就是 **AutoAI Cloud Dev** 的初衷：

> 用 AI 自动化整个软件开发过程。
> 

---

## 第二章：总体架构设计

AutoAI 的整体设计遵循「三层分离 + 数据驱动」的架构原则：

```
┌───────────────────────────────────────────┐
│                 前端层（Vue 3）            │
│  文件管理 · 实时预览 · AI 聊天 · 可视化   │
└───────────────────────────────────────────┘
                ↓ API 调用
┌───────────────────────────────────────────┐
│                 后端层（Node.js + Express）│
│  AI指令调度 · 文件系统控制 · 路由服务     │
└───────────────────────────────────────────┘
                ↓ SQL 映射
┌───────────────────────────────────────────┐
│                 数据层（MySQL）           │
│  动态表结构 · 虚拟文件系统 · 项目隔离     │
└───────────────────────────────────────────┘

```

---

## 第三章：系统架构演进

### 从「操作本地文件」到「云端虚拟文件系统」

在最初版本（v0.1）中，我尝试让 AI 直接调用 Node.js 的 `fs` 模块操作本地文件，例如：

```jsx
fs.writeFileSync('./src/App.vue', content)

```

但这很快遇到了瓶颈：

- 浏览器端无法访问本地磁盘；
- 云端部署时权限受限；
- 多用户协作完全不可行；
- 文件删除/回滚无安全保障。

于是我意识到：

**必须让“文件系统”存在于数据库中。**

换句话说：

> 让 MySQL 成为虚拟文件系统（DBFS）。
> 

这时的核心转变是：

- 文件 = 一条数据库记录
- 文件夹 = 一张数据库表
- 文件内容 = `content` 字段
- 目录层级 = 表名嵌套结构

例如：

```
project_autoai_cloud_dev
project_autoai_cloud_dev__src
project_autoai_cloud_dev__src__components

```

这样，AI 只需操作数据库，就能“间接”完成所有文件操作，

包括创建、修改、删除、重命名、回滚等。

---

## 第四章：后端实现过程（Node.js）

### 4.1 项目入口：`backend/index.js`

这是整个系统的中枢。

负责：

- 初始化数据库；
- 定义 API 接口；
- 启动 Express 服务器；
- 处理文件预览请求；
- 接入 AI 调度模块。

核心逻辑：

```jsx
import express from 'express';
import { projectService } from './services/projectService.js';

const app = express();
app.use(express.json());

// 项目文件读取接口
app.get('/api/projects/:id/files', async (req, res) => {
  const files = await projectService.getProjectStructure(req.params.id);
  res.json(files);
});

// 文件预览
app.get('/api/projects/:projectId/preview', async (req, res) => {
  const { filePath } = req.query;
  const content = await projectService.getFileContent(req.params.projectId, filePath);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(content);
});

```

这里最关键的部分是：

所有与“文件”相关的行为都被 projectService.js 接管。

后端只是作为“调度员”，负责请求路由与权限验证。

---

## 第五章：核心服务层（projectService.js）

这一层是 AutoAI 的灵魂。

它把“文件系统”的所有行为抽象为数据库操作。

主要职责：

| 模块 | 功能 |
| --- | --- |
| 动态表管理 | 根据项目名生成对应表结构 |
| 文件/文件夹 CRUD | 以数据库记录表示文件 |
| 软删除机制 | 文件删除标记为 `deleted` 状态 |
| 表间递归 | 文件夹下的内容映射到子表 |
| 安全性控制 | 表名过滤、防注入处理 |

示例核心函数👇

### 🧩 表名生成器

```jsx
generateSafeTableName(projectName) {
  let safe = projectName.replace(/[^a-zA-Z0-9_]/g, '_');
  if (!/^[a-zA-Z]/.test(safe)) safe = 'project_' + safe;
  return safe.substring(0, 60).toLowerCase();
}

```

### 📁 文件保存逻辑

```jsx
async saveItemToFolderTable(projectId, folderTableName, itemData) {
  const [existing] = await pool.execute(`SHOW TABLES LIKE '${folderTableName}'`);
  if (!existing.length) await this.createFolderDataTable(projectId, folderTableName);

  await pool.execute(`INSERT INTO \`${folderTableName}\`
      (file_name, item_type, content, parent_path)
      VALUES (?, ?, ?, ?)`,
      [itemData.file_name, itemData.item_type, itemData.content, itemData.parent_path]);
}

```

### 🗑️ 文件软删除机制

```jsx
async deleteFile(projectId, fileName, filePath) {
  const deletedPath = `${filePath}-deleted-${Date.now()}`;
  await pool.execute(
    `UPDATE \`${safeTableName}\`
     SET status = 'deleted', file_path = ?
     WHERE file_name = ? AND file_path = ?`,
     [deletedPath, fileName, filePath]
  );
}

```

---

## 第六章：前端实现（Vue 3）

前端以三列布局为主：

```
左侧：文件树（FileTreeDisplay）
中间：实时预览（ProjectPreview）
右侧：AI 助手（AIChatBox）

```

每个部分均以组件化方式独立运行，通过 `props` 与事件通信实现联动。

例如：

- 点击文件 → `@file-selected` → 预览组件刷新内容；
- AI 创建文件 → `@file-created` → 文件树实时更新；
- 用户编辑代码 → `v-model` 同步数据库内容。

# 🧩 第八章：逐文件功能说明（全项目文件解构分析）

---

## 📁 一、后端核心目录结构

```
backend/
├── index.js                     # 服务入口与路由注册
├── config/
│   └── database.js              # 数据库连接与初始化
├── services/
│   ├── aiService.js             # AI 指令解析与执行
│   ├── projectService.js        # 虚拟文件系统与数据库管理核心
│   └── userService.js           # 用户与项目权限服务
└── utils/
    └── fileUtils.js             # 文件路径与内容格式化工具

```

---

## 1️⃣ `backend/index.js` — 系统主控中枢

### 📘 功能概述

负责整个后端服务的入口初始化与接口分发，是逻辑层与展示层之间的桥梁。

所有来自前端（Vue）的请求，都先经过这里，再分发到相应的 service 层。

### ⚙️ 主要模块

| 模块 | 功能 |
| --- | --- |
| Express 初始化 | 启动 Web 服务，注册中间件 |
| 路由注册 | /api/ai、/api/projects、/api/users 等接口入口 |
| 预览处理 | 动态渲染 HTML / Vue 文件实时预览 |
| 错误捕获 | 捕获并统一返回 API 错误响应 |

### 🔩 核心代码段

```jsx
// AI 聊天 + 文件生成接口
app.post('/api/ai/chat', async (req, res) => {
  const { message, projectId, projectName, context } = req.body;

  const project = await projectService.getProject(projectId);
  const result = await aiService.processChat(message, projectId, projectName, context);

  if (result.actions?.length) {
    for (const action of result.actions) {
      await aiService.executeCodeModification(action, projectId, projectName);
    }
  }
  res.json({ success: true, data: result });
});

```

### 💡 设计思路

- 使用 `async/await` 进行异步任务编排，避免阻塞。
- 将所有复杂逻辑（文件写入、AI 请求）抽离至 `services/` 层，保持入口简洁。
- 增加统一的跨域处理（`app.use(cors())`），支持前后端分离部署。

---

## 2️⃣ `backend/config/database.js` — 数据引擎核心

### 📘 功能概述

负责 MySQL 数据库连接池管理、动态表初始化与系统表创建。

是整个“虚拟文件系统”的底层驱动。

### ⚙️ 核心逻辑

```jsx
const pool = mysql.createPool({
  host: '39.108.142.250',
  user: 'wslop',
  password: '345345',
  database: 'autoai',
  connectionLimit: 10,
  charset: 'utf8mb4'
});

async function initDatabase() {
  await pool.execute(createProjectTable);
  await pool.execute(createLogTable);
  await pool.execute(createAIConversationTable);
}

```

### 💡 设计思路

- 采用 **连接池（Pool）** 优化多用户并发。
- 初始化自动创建必要表结构，支持系统级恢复。
- 所有项目表在运行时动态创建，提升项目隔离性。

---

## 3️⃣ `backend/services/projectService.js` — 数据与文件双栖模块

### 📘 功能概述

这是整个 AutoAI 最核心的模块。

它将数据库表结构抽象成文件系统，让“项目文件夹”在 MySQL 中存在。

### 🧱 核心功能模块

| 模块 | 功能说明 |
| --- | --- |
| 表名生成器 | 根据项目名生成安全表名 |
| 动态表管理器 | 自动创建/删除项目表 |
| 文件 CRUD | 以 SQL 方式实现文件增删改查 |
| 虚拟路径解析 | 将路径映射为表层级结构 |
| 回滚机制 | 删除文件时保留副本 |
| 清理服务 | 定期删除 `deleted` 状态文件 |

### 🔩 核心代码示例

### ✅ 表名生成

```jsx
generateSafeTableName(name) {
  let safe = name.replace(/[^a-zA-Z0-9_]/g, '_');
  if (!/^[a-zA-Z]/.test(safe)) safe = 'project_' + safe;
  return safe.slice(0, 60).toLowerCase();
}

```

### 📁 文件保存

```jsx
async saveItemToFolderTable(projectId, folderTableName, itemData) {
  const [exist] = await pool.execute(`SHOW TABLES LIKE '${folderTableName}'`);
  if (!exist.length) await this.createFolderDataTable(projectId, folderTableName);

  await pool.execute(
    `INSERT INTO \`${folderTableName}\`
      (file_name, item_type, content, parent_path)
     VALUES (?, ?, ?, ?)`,
    [itemData.file_name, itemData.item_type, itemData.content, itemData.parent_path]
  );
}

```

### 🗑️ 软删除机制

```jsx
async deleteFile(projectId, fileName, filePath) {
  const deletedPath = `${filePath}-deleted-${Date.now()}`;
  await pool.execute(
    `UPDATE \`${safeTableName}\`
     SET status='deleted', file_path=?
     WHERE file_name=? AND file_path=?`,
    [deletedPath, fileName, filePath]
  );
}

```

### 💡 设计亮点

- **文件夹即表结构**：每个文件夹自动映射为一张表；
- **软删除机制**：保证唯一约束与可回滚性；
- **层级存储**：深层路径递归映射；
- **性能优化**：建立复合索引与延迟清理任务。

---

## 4️⃣ `backend/services/aiService.js` — AI 智能编排层

### 📘 功能概述

负责解析用户自然语言请求、构建提示词、调用 DeepSeek API、解析结果并执行文件操作。

### 🔩 核心流程

```jsx
async processChat(userInput, projectId, projectName, context) {
  await projectService.cleanupDeletedFiles(projectId, projectName);

  const prompt = this.buildSystemPrompt(projectId, projectName);
  const aiResponse = await this.callDeepSeekAPI(prompt, userInput);
  const actions = this.parseAIResponse(aiResponse);

  for (const action of actions) {
    await this.executeCodeModification(action, projectId, projectName);
  }

  return { response: aiResponse, actions };
}

```

### 💡 创新点

- 将 AI 响应解析为 “操作指令对象”
    
    ```jsx
    { type: 'create_file', description: '新建 App.vue', code: '...' }
    
    ```
    
- 通过命令模式执行，实现解耦与可追踪性；
- 支持多动作组合执行，配合回滚机制防止损坏项目结构。

---

## 5️⃣ `frontend/src/views/MainApp.vue` — 前端主界面

### 📘 功能概述

整个 AutoAI 前端的中控页面，

采用三栏布局 + 响应式设计，整合 AI 助手、文件树与实时预览。

### ⚙️ 布局结构

```
左：FileTreeDisplay.vue
中：ProjectPreview.vue
右：AIChatBox.vue

```

### 🔩 核心逻辑

```
<FileTreeDisplay @file-selected="onFileSelected" />
<ProjectPreview :selected-file="selectedFile" />
<AIChatBox @file-created="refreshFiles" />

```

### 💡 特点

- 双向事件通信；
- 文件、预览、AI 三者实时同步；
- Vue 3 Composition API 实现模块化逻辑。

---

## 6️⃣ `frontend/src/components/ProjectPreview.vue` — 实时预览核心

### 📘 功能概述

负责 HTML/Vue 文件的动态渲染。

支持 iframe 实时预览与代码编辑保存。

### 🔩 核心逻辑

```
<iframe :src="previewUrl" class="preview-frame" />
<textarea v-model="codeContent"></textarea>
<button @click="saveCode">💾 保存</button>

```

### 💡 特点

- 支持双模式（预览 / 编辑）切换；
- 自动构建文件 API URL；
- 错误状态与加载动画处理完善；
- 实时刷新不重载全页。

---

## 7️⃣ `frontend/src/components/AIChatBox.vue` — AI 聊天与任务触发中心

### 📘 功能概述

实现与 AI 的实时交互，包括自然语言输入、消息列表渲染与任务触发。

### 🔩 核心逻辑

```jsx
async sendMessage() {
  const response = await axios.post('/api/ai/chat', { message, projectId });
  messages.push({ role: 'assistant', content: response.data });
}

```

### 💡 设计亮点

- 消息渲染采用递归列表；
- 状态提示（正在输入...）；
- AI 响应解析为操作按钮，可直接应用修改。

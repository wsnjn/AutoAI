<template>
  <div class="main-app">
    <!-- 顶部导航栏 -->
    <header class="app-header">
      <div class="header-content">
        <div class="header-left">
          <h1> AutoAI 项目管理平台</h1>
          <div class="project-info">
            <span class="project-name">{{ currentProject?.name || '加载中...' }}</span>
            <span class="project-id">ID: {{ currentProject?.id }}</span>
            <span class="project-members">👥 {{ memberCount }} 成员</span>
          </div>
        </div>
        <div class="header-right">
          <button @click="toggleSettings" class="btn-settings">⚙️ 设置</button>
          <button @click="changeProject" class="btn-secondary">← 返回项目列表</button>
        </div>
      </div>
    </header>

    <!-- 主要内容区域 -->
    <main class="app-main">
      <!-- 三列布局 -->
      <div class="main-content">
        <!-- 左侧：文件树/文件管理器切换 -->
        <div class="left-panel">
          <div class="panel-header">
            <div class="tab-buttons">
              <button 
                @click="activeLeftTab = 'fileTree'" 
                :class="['tab-btn', { active: activeLeftTab === 'fileTree' }]"
              >
                🌳 文件树
              </button>
              <button 
                @click="activeLeftTab = 'fileManager'" 
                :class="['tab-btn', { active: activeLeftTab === 'fileManager' }]"
              >
                📁 文件管理
              </button>
            </div>
          </div>
          <div class="left-content">
            <!-- 文件树 -->
            <div v-if="activeLeftTab === 'fileTree'" class="tab-content">
              <FileTreeDisplay 
                ref="fileTree"
                :project-id="currentProject ? currentProject.id : ''"
                :project-name="currentProject ? currentProject.name : ''"
                @refresh="refreshFileManager"
                @file-selected="onFileSelected"
                @edit-item="onFileSelected"
              />
            </div>
            <!-- 文件管理器 -->
            <div v-if="activeLeftTab === 'fileManager'" class="tab-content">
              <SimpleFileManager 
                ref="fileManager"
                :project-id="currentProject ? currentProject.id : ''"
                :project-name="currentProject ? currentProject.name : ''"
                @refresh="refreshFileTree"
                @file-selected="onFileSelected"
              />
            </div>
          </div>
        </div>

        <!-- 中间：实时预览 -->
        <div class="center-panel">
          <ProjectPreview 
            :project-id="currentProject ? currentProject.id : ''"
            :project-name="currentProject ? currentProject.name : ''"
            :selected-file="selectedFile"
            ref="projectPreview"
            @file-updated="onFileUpdated"
          />
        </div>

        <!-- 右侧：AI助手 -->
        <div class="right-panel">
          <div class="panel-header">
            <h3>🤖 AI助手</h3>
          </div>
          <div class="ai-content">
            <AIChatBox 
              :project-id="currentProject ? currentProject.id : ''"
              :project-name="currentProject ? currentProject.name : ''"
              @file-created="onFileCreated"
              @file-deleted="onFileDeleted"
            />
          </div>
        </div>
      </div>
    </main>

    <!-- 设置面板（可折叠）-->
    <div v-if="showSettings" class="settings-panel">
      <div class="settings-header">
        <h3>⚙️ 项目设置</h3>
        <button @click="toggleSettings" class="btn-close">✕</button>
      </div>
      <div class="settings-content">
        <div v-if="currentProject?.description" class="setting-group">
          <h4>📄 项目描述</h4>
          <p>{{ currentProject.description }}</p>
        </div>
        
        <div v-if="currentProject?.settings" class="setting-group">
          <h4>⚙️ 项目设置</h4>
          <div class="settings-grid">
            <div class="setting-item">
              <span>允许加入:</span>
              <div class="setting-control">
                <label class="switch">
                  <input 
                    type="checkbox" 
                    v-model="currentProject.settings.allowJoin"
                    @change="updateProjectSettings"
                  >
                  <span class="slider round"></span>
                </label>
                <span class="setting-value">{{ currentProject.settings.allowJoin ? '是' : '否' }}</span>
              </div>
            </div>
            <div class="setting-item">
              <span>最大成员数:</span>
              <div class="setting-control">
                <input 
                  type="number" 
                  v-model.number="currentProject.settings.maxMembers"
                  min="1" 
                  max="50"
                  @change="updateProjectSettings"
                  class="number-input"
                >
                <span class="setting-value">人 (当前: {{ memberCount }})</span>
              </div>
            </div>
            <div class="setting-item">
              <span>支持文件类型:</span>
              <span class="setting-value">{{ currentProject.settings.fileTypes ? currentProject.settings.fileTypes.join(', ') : '无' }}</span>
            </div>
          </div>
        </div>

        <div class="setting-group">
          <h4>📋 项目活动日志</h4>
          <div v-if="projectLogs.length > 0" class="logs-list">
            <div 
              v-for="log in projectLogs.slice(0, 5)" 
              :key="log.id"
              class="log-item"
            >
              <div class="log-icon">📝</div>
              <div class="log-content">
                <div class="log-action">{{ log.action }}</div>
                <div class="log-time">{{ formatDate(log.created_at) }}</div>
              </div>
            </div>
          </div>
          <div v-else class="no-logs">
            <p>📝 暂无活动日志</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import AIChatBox from '../components/AIChatBox.vue'
import SimpleFileManager from '../components/SimpleFileManager.vue'
import FileTreeDisplay from '../components/FileTreeDisplay.vue'
import ProjectPreview from '../components/ProjectPreview.vue'

export default {
  name: 'MainApp',
  components: {
    AIChatBox,
    SimpleFileManager,
    FileTreeDisplay,
    ProjectPreview
  },
  data() {
    return {
      currentProject: null,
      projectFiles: [],
      projectLogs: [],
      memberCount: 0,
      showSettings: false,
      previewUrl: null,
      activeLeftTab: 'fileTree', // 默认显示文件树
      selectedFile: null // 当前选择的文件
    }
  },
  computed: {
    projectId() {
      return this.currentProject?.id
    }
  },
  async mounted() {
    await this.loadCurrentProject()
  },
  methods: {
    async loadCurrentProject() {
      try {
        const projectId = this.$route.params.projectId
        if (!projectId) {
          this.$router.push('/')
          return
        }

        const response = await fetch(`http://39.108.142.250:3000/api/projects/${projectId}`)
        const result = await response.json()
        
        if (result.success) {
          this.currentProject = result.data
          await this.loadProjectLogs()
          await this.loadMemberCount()
        } else {
          console.error('加载项目失败:', result.error)
          this.$router.push('/')
        }
      } catch (error) {
        console.error('加载项目失败:', error)
        this.$router.push('/')
      }
    },

    async loadProjectLogs() {
      if (!this.currentProject?.id) return
      
      try {
        const response = await fetch(`http://39.108.142.250:3000/api/projects/${this.currentProject.id}/logs`)
        const result = await response.json()
        
        if (result.success) {
          this.projectLogs = result.data
        }
      } catch (error) {
        console.error('加载项目日志失败:', error)
      }
    },

    async loadMemberCount() {
      if (!this.currentProject?.id) return
      
      try {
        const response = await fetch(`http://39.108.142.250:3000/api/projects/${this.currentProject.id}/member-count`)
        const result = await response.json()
        
        if (result.success) {
          this.memberCount = result.data
        }
      } catch (error) {
        console.error('加载成员数量失败:', error)
      }
    },

    async loadFiles() {
      if (!this.currentProject?.id) return
      
      try {
        const response = await fetch(`http://39.108.142.250:3000/api/projects/${this.currentProject.id}/files`)
        const result = await response.json()
        
        if (result.success) {
          this.projectFiles = result.data
        }
      } catch (error) {
        console.error('加载项目文件失败:', error)
      }
    },

    async updateProjectSettings() {
      if (!this.currentProject?.id) return
      
      try {
        const response = await fetch(`http://39.108.142.250:3000/api/projects/${this.currentProject.id}/settings`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            allowJoin: this.currentProject.settings.allowJoin,
            maxMembers: this.currentProject.settings.maxMembers
          })
        })
        
        const result = await response.json()
        if (result.success) {
          console.log('项目设置更新成功')
        } else {
          console.error('更新项目设置失败:', result.error)
        }
      } catch (error) {
        console.error('更新项目设置失败:', error)
      }
    },

    refreshFileTree() {
      if (this.$refs.fileTree) {
        this.$refs.fileTree.loadFileTree()
      }
    },

    refreshFileManager() {
      if (this.$refs.fileManager) {
        this.$refs.fileManager.loadFiles()
      }
    },

    refreshLeftPanel() {
      if (this.activeLeftTab === 'fileTree') {
        this.refreshFileTree()
      } else if (this.activeLeftTab === 'fileManager') {
        this.refreshFileManager()
      }
    },

    refreshPreview() {
      if (this.$refs.projectPreview) {
        this.$refs.projectPreview.refreshPreview()
      }
    },

    openInNewTab() {
      if (this.$refs.projectPreview) {
        this.$refs.projectPreview.openInNewTab()
      }
    },

    toggleSettings() {
      this.showSettings = !this.showSettings
    },

    changeProject() {
      this.$router.push('/')
    },

    onFileCreated() {
      this.refreshFileTree()
      this.refreshFileManager()
      this.refreshPreview()
      this.loadProjectLogs()
    },

    onFileDeleted() {
      this.refreshFileTree()
      this.refreshFileManager()
      this.refreshPreview()
      this.loadProjectLogs()
    },

    onFileSelected(file) {
      console.log('🔍 MainApp onFileSelected called:', file)
      console.log('🔍 当前 selectedFile:', this.selectedFile)
      this.selectedFile = file
      console.log('✅ selectedFile 已更新:', this.selectedFile)
      console.log('🔍 更新后的 selectedFile 详情:', {
        fileName: this.selectedFile?.file_name,
        filePath: this.selectedFile?.file_path,
        itemType: this.selectedFile?.item_type
      })
    },

    onFileUpdated(file) {
      console.log('文件已更新', file)
      // 刷新文件树和文件管理器
      this.refreshFileTree()
      this.refreshFileManager()
      // 刷新项目日志
      this.loadProjectLogs()
    },

    formatDate(dateString) {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleString('zh-CN')
    }
  }
}
</script>

<style scoped>
.main-app {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
}

/* 顶部导航栏 */
.app-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  padding: 1rem 2rem;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1400px;
  margin: 0 auto;
}

.header-left h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #333;
  font-weight: 600;
}

.project-info {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: #666;
}

.project-name {
  font-weight: 600;
  color: #667eea;
}

.header-right {
  display: flex;
  gap: 1rem;
}

.btn-settings, .btn-secondary {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.btn-settings {
  background: #667eea;
  color: white;
}

.btn-settings:hover {
  background: #5a6fd8;
}

.btn-secondary {
  background: #f8f9fa;
  color: #666;
  border: 1px solid #e9ecef;
}

.btn-secondary:hover {
  background: #e9ecef;
}

/* 主要内容区域 */
.app-main {
  flex: 1;
  padding: 1rem;
  width: 100%;
}

.main-content {
  display: grid;
  grid-template-columns: 350px 1fr 350px;
  gap: 1rem;
  height: calc(100vh - 60px);
}

/* 左侧面板 */
.left-panel {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

.panel-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

/* 标签按钮 */
.tab-buttons {
  display: flex;
  gap: 0.5rem;
}

.tab-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.tab-btn.active {
  background: rgba(255, 255, 255, 0.4);
  border-color: rgba(255, 255, 255, 0.6);
}

.left-content {
  flex: 1;
  overflow: hidden;
}

.tab-content {
  height: 100%;
  overflow: hidden;
}

/* 中间面板 */
.center-panel {
  background: white;
  border-radius: 0 0 20px 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  height: 100%;
  position: relative; /* 为绝对定位的子组件提供定位上下文 */
}

.btn-refresh {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.3s ease;
}

.btn-refresh:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.file-tree-container {
  height: calc(100% - 60px);
  overflow-y: auto;
  padding: 1rem;
}

/* 右侧面板 */
.right-panel {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.ai-content {
  flex: 1;
  overflow: hidden;
}

/* 响应式设置 */
@media (max-width: 1200px) {
  .main-content {
    grid-template-columns: 300px 1fr 300px;
  }
}

/* 设置面板 */
.settings-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10px);
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
  z-index: 200;
  overflow-y: auto;
}

.settings-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.settings-header h3 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.btn-close {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.settings-content {
  padding: 1.5rem;
}

.setting-group {
  margin-bottom: 2rem;
}

.setting-group h4 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1rem;
  font-weight: 600;
}

.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f0f0f0;
}

.setting-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.setting-value {
  font-size: 0.9rem;
  color: #666;
}

.number-input {
  width: 60px;
  padding: 0.25rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

/* 开关样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #667eea;
}

input:checked + .slider:before {
  transform: translateX(26px);
}

/* 日志样式 */
.logs-list {
  max-height: 300px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f0f0f0;
}

.log-icon {
  font-size: 1rem;
}

.log-content {
  flex: 1;
}

.log-action {
  font-size: 0.9rem;
  color: #333;
  font-weight: 500;
}

.log-time {
  font-size: 0.8rem;
  color: #999;
  margin-top: 0.25rem;
}

.no-logs {
  text-align: center;
  color: #999;
  padding: 2rem;
}

/* 响应式设置 */
@media (max-width: 1200px) {
  .main-content {
    grid-template-columns: 300px 1fr;
  }
  
  .bottom-panels {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .app-main {
    padding: 1rem;
  }
  
  .main-content {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .file-tree-container,
  .preview-container {
    height: 400px;
  }
  
  .header-content {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
  
  .project-info {
    justify-content: center;
  }
  
  .settings-panel {
    width: 100%;
  }
}
</style>

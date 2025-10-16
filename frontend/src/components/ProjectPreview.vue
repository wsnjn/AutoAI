<template>
  <div class="preview-container">
    <div class="preview-header">
      <div class="tab-buttons">
        <button 
          @click="activeTab = 'preview'" 
          :class="['tab-btn', { active: activeTab === 'preview' }]"
        >
          📄 预览
        </button>
        <button 
          @click="activeTab = 'code'" 
          :class="['tab-btn', { active: activeTab === 'code' }]"
        >
          📝 代码
        </button>
      </div>
      <div class="preview-controls">
        <button @click="refreshPreview" class="btn-refresh" :disabled="loading">
          <span v-if="loading" class="spinner-small"></span>
          <span v-else>🔄</span>
          刷新
        </button>
        <button @click="openInNewTab" class="btn-new-tab" :disabled="!previewUrl">
          🔗 新窗口
        </button>
      </div>
    </div>
    
    <div class="preview-content">
      <!-- 预览模式 -->
      <div v-if="activeTab === 'preview'">
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>正在加载预览...</p>
        </div>
        
        <div v-else-if="error" class="error-state">
          <div class="error-icon">❌</div>
          <p>{{ error }}</p>
          <button @click="refreshPreview" class="btn-retry">重试</button>
        </div>
        
        <div v-else-if="!hasPreviewableFiles" class="no-preview-state">
          <div class="no-preview-icon">📄</div>
          <p>当前项目中没有可预览的文件</p>
          <p class="hint">创建 index.html、App.vue 或其他HTML/Vue文件来查看预览效果</p>
        </div>
        
        <div v-else class="preview-frame-container">
          <iframe 
            ref="previewFrame"
            :src="previewUrl" 
            class="preview-frame"
            frameborder="0"
            @load="onPreviewLoad"
            @error="onPreviewError"
          ></iframe>
        </div>
      </div>
      
      <!-- 代码编辑模式 -->
      <div v-else-if="activeTab === 'code'" class="code-editor-container">
        <div v-if="!selectedFile" class="no-file-state">
          <div class="no-file-icon">📝</div>
          <p>请选择一个文件来编辑代码</p>
          <p class="hint">从左侧文件树或文件管理器中选择文件</p>
        </div>
        
        <div v-else class="code-editor">
          <div class="editor-header">
            <span class="file-name">{{ selectedFile.file_name }}</span>
            <span class="file-size">{{ previewSize }}</span>
            <div class="editor-actions">
              <button @click="saveCode" class="btn-save" :disabled="!hasChanges">
                💾 保存
              </button>
              <button @click="resetCode" class="btn-reset" :disabled="!hasChanges">
                🔄 重置
              </button>
            </div>
          </div>
          
          <div class="editor-content">
            <textarea
              v-model="codeContent"
              class="code-textarea"
              :placeholder="`编辑 ${selectedFile.file_name} 的代码...`"
              @input="onCodeChange"
            ></textarea>
          </div>
          
          <div v-if="saveStatus" class="save-status" :class="saveStatus.type">
            {{ saveStatus.message }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ProjectPreview',
  props: {
    projectId: {
      type: String,
      required: true
    },
    projectName: {
      type: String,
      required: true
    },
    selectedFile: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      loading: false,
      error: null,
      previewUrl: null,
      currentPreviewFile: null,
      previewSize: '',
      hasPreviewableFiles: false,
      htmlFiles: [],
      activeTab: 'preview', // 当前激活的标签页
      codeContent: '', // 代码内容
      originalCodeContent: '', // 原始代码内容
      hasChanges: false, // 是否有未保存的更改
      saveStatus: null // 保存状态
    }
  },
  watch: {
    projectId: {
      handler() {
        this.loadPreviewFiles()
      },
      immediate: true
    },
    selectedFile: {
      handler(newFile, oldFile) {
        console.log('🔍 ProjectPreview selectedFile watch triggered:', {
          newFile: newFile,
          oldFile: oldFile,
          newFileName: newFile?.file_name,
          oldFileName: oldFile?.file_name
        })
        if (newFile) {
          console.log('🔍 File details:', {
            fileName: newFile.file_name,
            filePath: newFile.file_path,
            itemType: newFile.item_type,
            isPreviewable: this.isPreviewableFile(newFile)
          })
          
          if (this.isPreviewableFile(newFile)) {
            console.log('✅ 文件可预览，设置预览')
            this.setPreviewFile(newFile)
            this.loadFileContent(newFile)
          } else {
            console.log('📝 文件不可预览，仅加载内容用于代码编辑')
            this.loadFileContent(newFile)
          }
        } else {
          console.log('❌ 没有选择文件')
        }
      },
      immediate: true
    }
  },
  methods: {
    async loadPreviewFiles() {
      if (!this.projectId) {
        this.hasPreviewableFiles = false
        return
      }
      
      try {
        this.loading = true
        this.error = null
        
        // 获取项目文件列表
        const response = await fetch(`http://39.108.142.250:3000/api/projects/${this.projectId}/files`)
        const result = await response.json()
        
        if (result.success) {
          // 筛选出可预览的文件（HTML和Vue文件），排除已删除的文件
          this.htmlFiles = result.data.filter(file => 
            file.item_type === 'file' && 
            !file.file_path.includes('-deleted-') && // 排除已删除的文件（检查file_path字段）
            (file.file_name.endsWith('.html') || 
             file.file_name.endsWith('.htm') ||
             file.file_name.endsWith('.vue'))
          )
          
          this.hasPreviewableFiles = this.htmlFiles.length > 0
          
          if (this.hasPreviewableFiles) {
            // 优先选择index.html，否则选择第一个HTML文件
            const indexFile = this.htmlFiles.find(f => f.file_name === 'index.html')
            const previewFile = indexFile || this.htmlFiles[0]
            this.setPreviewFile(previewFile)
          }
        } else {
          this.error = '获取项目文件失败'
        }
      } catch (error) {
        console.error('加载预览文件失败:', error)
        this.error = '加载预览文件失败'
      } finally {
        this.loading = false
      }
    },
    
    isPreviewableFile(file) {
      return file && file.item_type === 'file' && 
             !file.file_path.includes('-deleted-') && // 排除已删除的文件（检查file_path字段）
             (file.file_name.endsWith('.html') || 
              file.file_name.endsWith('.htm') ||
              file.file_name.endsWith('.vue'))
    },
    
    setPreviewFile(file) {
      console.log('🔍 setPreviewFile called:', file)
      if (!file || !this.isPreviewableFile(file)) {
        console.log('❌ 文件无效或不可预览')
        this.previewUrl = null
        this.currentPreviewFile = null
        return
      }
      
      this.currentPreviewFile = file.file_name
      this.previewSize = this.formatFileSize(file.file_size)
      
      // 创建预览URL
      const baseUrl = `http://39.108.142.250:3000/api/projects/${this.projectId}/preview`
      this.previewUrl = `${baseUrl}?filePath=${encodeURIComponent(file.file_path)}`
      
      console.log('✅ 预览文件已设置:', {
        fileName: this.currentPreviewFile,
        previewUrl: this.previewUrl,
        fileSize: this.previewSize
      })
    },
    
    async refreshPreview() {
      if (this.selectedFile && this.isPreviewableFile(this.selectedFile)) {
        this.setPreviewFile(this.selectedFile)
      } else {
        await this.loadPreviewFiles()
      }
    },
    
    openInNewTab() {
      if (this.previewUrl) {
        window.open(this.previewUrl, '_blank')
      }
    },
    
    onPreviewLoad() {
      console.log('预览加载完成')
    },
    
    onPreviewError() {
      this.error = '预览加载失败'
    },
    
    formatFileSize(bytes) {
      if (!bytes) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    },

    // 加载文件内容
    async loadFileContent(file) {
      if (!file || !this.projectId) return
      
      try {
        this.loading = true
        const response = await fetch(`http://39.108.142.250:3000/api/projects/${this.projectId}/file-content?filePath=${encodeURIComponent(file.file_path)}`)
        const result = await response.json()
        
        if (result.success && result.data) {
          this.codeContent = result.data.content || ''
          this.originalCodeContent = this.codeContent
          this.hasChanges = false
          this.saveStatus = null
        } else {
          console.error('加载文件内容失败:', result.error)
          this.saveStatus = { type: 'error', message: '加载文件内容失败' }
        }
      } catch (error) {
        console.error('加载文件内容错误:', error)
        this.saveStatus = { type: 'error', message: '加载文件内容失败' }
      } finally {
        this.loading = false
      }
    },

    // 代码内容变化处理
    onCodeChange() {
      this.hasChanges = this.codeContent !== this.originalCodeContent
      this.saveStatus = null
    },

    // 保存代码
    async saveCode() {
      if (!this.selectedFile || !this.projectId) return
      
      try {
        this.loading = true
        const response = await fetch(`http://39.108.142.250:3000/api/projects/${this.projectId}/update-file`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filePath: this.selectedFile.file_path,
            content: this.codeContent
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          this.originalCodeContent = this.codeContent
          this.hasChanges = false
          this.saveStatus = { type: 'success', message: '保存成功' }
          
          // 如果是HTML文件，刷新预览
          if (this.isPreviewableFile(this.selectedFile)) {
            this.refreshPreview()
          }
          
          // 通知父组件文件已更新
          this.$emit('file-updated', this.selectedFile)
        } else {
          this.saveStatus = { type: 'error', message: result.error || '保存失败' }
        }
      } catch (error) {
        console.error('保存代码失败:', error)
        this.saveStatus = { type: 'error', message: '保存失败' }
      } finally {
        this.loading = false
      }
    },

    // 重置代码
    resetCode() {
      if (confirm('确定要重置代码吗？未保存的更改将丢失！')) {
        this.codeContent = this.originalCodeContent
        this.hasChanges = false
        this.saveStatus = null
      }
    }
  }
}
</script>

<style scoped>
.preview-container {
  background: transparent;
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.preview-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.tab-buttons {
  display: flex;
  gap: 8px;
}

.tab-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9em;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.tab-btn.active {
  background: rgba(255, 255, 255, 0.9);
  color: #667eea;
  font-weight: 600;
}

.preview-header h3 {
  margin: 0;
  font-size: 1.1em;
  font-weight: 600;
}

.preview-controls {
  display: flex;
  gap: 8px;
}

.btn-refresh, .btn-new-tab {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-refresh:hover, .btn-new-tab:hover {
  background: rgba(255, 255, 255, 0.3);
}

.btn-refresh:disabled, .btn-new-tab:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner-small {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.preview-content {
  position: absolute;
  top: 60px; /* 从头部下方开始 */
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.loading-state, .error-state, .no-preview-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #666;
  padding: 40px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon, .no-preview-icon {
  font-size: 48px;
  margin-bottom: 20px;
}

.btn-retry {
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 15px;
  transition: background 0.3s ease;
}

.btn-retry:hover {
  background: #5a6fd8;
}

.hint {
  font-size: 14px;
  color: #999;
  margin-top: 10px;
}

.preview-frame-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: white;
  overflow: hidden;
}

.preview-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
  border-radius: 0;
  display: block;
}

/* 响应式设置 */
@media (max-width: 1200px) {
  .preview-frame {
    /* 移除缩放设置 */
  }
}

@media (max-width: 768px) {
  .preview-header {
    flex-direction: column;
    gap: 10px;
    text-align: center;
    padding: 12px 15px;
  }
  
  .preview-controls {
    justify-content: center;
  }
  
  .preview-frame {
    /* 移除缩放设置 */
  }
}

@media (max-width: 480px) {
  .preview-frame {
    /* 移除缩放设置 */
  }
}

/* 代码编辑器样式 */
.code-editor-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.no-file-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  text-align: center;
}

.no-file-icon {
  font-size: 48px;
  margin-bottom: 20px;
}

.code-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.editor-header {
  background: #f8f9fa;
  padding: 12px 16px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.file-name {
  font-weight: 600;
  color: #333;
  font-size: 1.1em;
}

.file-size {
  color: #666;
  font-size: 0.9em;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.btn-save, .btn-reset {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 0.9em;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-save {
  background: #28a745;
  color: white;
}

.btn-save:hover:not(:disabled) {
  background: #218838;
}

.btn-save:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.btn-reset {
  background: #6c757d;
  color: white;
}

.btn-reset:hover:not(:disabled) {
  background: #5a6268;
}

.btn-reset:disabled {
  background: #adb5bd;
  cursor: not-allowed;
}

.editor-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.code-textarea {
  flex: 1;
  width: 100%;
  border: none;
  padding: 16px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  background: #f8f9fa;
  color: #333;
}

.code-textarea:focus {
  background: white;
}

.save-status {
  padding: 8px 16px;
  font-size: 0.9em;
  text-align: center;
  flex-shrink: 0;
}

.save-status.success {
  background: #d4edda;
  color: #155724;
  border-top: 1px solid #c3e6cb;
}

.save-status.error {
  background: #f8d7da;
  color: #721c24;
  border-top: 1px solid #f5c6cb;
}
</style>

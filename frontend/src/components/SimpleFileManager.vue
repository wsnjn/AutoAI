<template>
  <div class="simple-file-manager">
    <!-- 工具栏 -->
    <div class="toolbar">
      <button @click="uploadFile" class="btn upload-btn" :disabled="!projectId">📤 上传文件</button>
      <button @click="createFile" class="btn create-btn" :disabled="!projectId">📄 创建文件</button>
      <button @click="createFolder" class="btn folder-btn" :disabled="!projectId">📁 创建文件夹</button>
      <button @click="refreshFiles" class="btn refresh-btn" :disabled="!projectId">🔄 刷新</button>
    </div>

    <!-- 面包屑导航 -->
    <div class="breadcrumb" v-if="breadcrumb.length > 0">
      <span class="breadcrumb-item" @click="navigateToRoot">🏠 根目录</span>
      <template v-for="(item, index) in breadcrumb" :key="index">
        <span class="breadcrumb-separator">/</span>
        <span 
          class="breadcrumb-item"
          :class="{ 'active': index === breadcrumb.length - 1 }"
          @click="navigateToFolder(item)"
        >
          {{ item.file_name }}
        </span>
      </template>
    </div>

    <!-- 文件列表 -->
    <div class="file-tree">
      <h4>📁 项目文件 ({{ files.length }} 个)</h4>
      <div v-if="!projectId" class="empty-files">
        <p>请先选择或创建项目</p>
      </div>
      <div v-else-if="files.length === 0" class="empty-files">
        <p>暂无文件，点击上方按钮开始添加</p>
      </div>
      <div v-else class="files-list">
                 <div 
           v-for="file in files" 
           :key="file.id"
           class="file-item"
           :class="{ 
             'selected': currentFolder && currentFolder.id === file.id,
             'folder-item': file.item_type === 'folder'
           }"
           @click="selectFile(file)"
         >
          <span class="file-icon">
            {{ file.item_type === 'folder' ? '📁' : getFileIcon(file.file_type) }}
          </span>
          <span class="file-name">{{ file.file_name }}</span>
          <span class="file-size" v-if="file.item_type === 'file'">
            {{ formatBytes(file.file_size) }}
          </span>
          <div class="file-actions">
            <button v-if="file.item_type === 'folder'" @click.stop="enterFolder(file)" class="action-btn">📂</button>
            <button @click.stop="viewFile(file)" class="action-btn">👁️</button>
            <button @click.stop="deleteFile(file)" class="action-btn">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 上传文件对话框 -->
    <div v-if="showUploadDialog" class="modal">
      <div class="modal-content">
        <h3>📤 上传文件</h3>
        <input type="file" @change="handleFileUpload" multiple />
        <div class="modal-actions">
          <button @click="showUploadDialog = false">取消</button>
          <button @click="confirmUpload" :disabled="!selectedFiles.length">上传</button>
        </div>
      </div>
    </div>

    <!-- 创建文件对话框 -->
    <div v-if="showCreateDialog" class="modal">
      <div class="modal-content">
        <h3>📄 创建文件</h3>
        <input v-model="newFileName" placeholder="文件名(如: index.js)" />
        <textarea v-model="newFileContent" placeholder="文件内容" rows="5"></textarea>
        <div class="modal-actions">
          <button @click="showCreateDialog = false">取消</button>
          <button @click="confirmCreate" :disabled="!newFileName">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SimpleFileManager',
  props: {
    projectId: String,
    projectName: String
  },
  data() {
    return {
      files: [],
      showUploadDialog: false,
      showCreateDialog: false,
      selectedFiles: [],
      newFileName: '',
      newFileContent: '',
      currentFolder: null, // 当前选中的文件夹
      breadcrumb: [] // 面包屑导航
    }
  },
  watch: {
    projectId: {
      handler(newProjectId) {
        if (newProjectId) {
          this.loadFiles()
        } else {
          this.files = []
          this.currentFolder = null
          this.breadcrumb = []
        }
      },
      immediate: true
    }
  },
  mounted() {
    // 只有在projectId存在时才加载数据
    if (this.projectId) {
      this.loadFiles()
    }
  },
  methods: {
    async loadFiles() {
      if (!this.projectId) {
        console.log('⚠️ projectId为空，跳过文件加载')
        return
      }
      
      try {
        const parentPath = this.currentFolder ? this.currentFolder.file_path : null
        const url = parentPath 
          ? `http://39.108.142.250:3000/api/projects/${this.projectId}/files?parent_path=${encodeURIComponent(parentPath)}`
          : `http://39.108.142.250:3000/api/projects/${this.projectId}/files`
        
        const response = await fetch(url)
        const result = await response.json()
        if (result.success) {
          this.files = result.data
        }
      } catch (error) {
        console.error('加载文件失败:', error)
      }
    },

    uploadFile() {
      if (!this.projectId) {
        console.log('⚠️ projectId为空，无法上传文件')
        return
      }
      this.showUploadDialog = true
    },

    createFile() {
      if (!this.projectId) {
        console.log('⚠️ projectId为空，无法创建文件')
        return
      }
      this.showCreateDialog = true
      this.newFileName = ''
      this.newFileContent = ''
    },

    createFolder() {
      if (!this.projectId) {
        console.log('⚠️ projectId为空，无法创建文件夹')
        return
      }
      this.newFileName = prompt('请输入文件夹名称:')
      if (this.newFileName) {
        this.createFolderAPI()
      }
    },

    async createFolderAPI() {
      if (!this.projectId) {
        console.log('⚠️ projectId为空，无法创建文件夹')
        return
      }
      
      try {
        const parentPath = this.currentFolder ? this.currentFolder.file_path : null
        const response = await fetch(`http://39.108.142.250:3000/api/projects/${this.projectId}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_name: this.newFileName,
            parent_path: parentPath,
            created_by: 'current_user'
          })
        })
        const result = await response.json()
        if (result.success) {
          this.loadFiles()
        }
      } catch (error) {
        console.error('创建文件夹失败:', error)
      }
    },

    handleFileUpload(event) {
      this.selectedFiles = Array.from(event.target.files)
    },

    async confirmUpload() {
      if (!this.projectId) {
        console.log('⚠️ projectId为空，无法上传文件')
        return
      }
      
      const parentPath = this.currentFolder ? this.currentFolder.file_path : null
      for (const file of this.selectedFiles) {
        try {
          const content = await this.readFileContent(file)
          const response = await fetch(`http://39.108.142.250:3000/api/projects/${this.projectId}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_name: file.name,
              file_type: file.name.split('.').pop(),
              file_size: file.size,
              content: content,
              parent_path: parentPath,
              created_by: 'current_user'
            })
          })
          const result = await response.json()
          if (result.success) {
            console.log(`文件 ${file.name} 上传成功`)
          }
        } catch (error) {
          console.error(`文件 ${file.name} 上传失败:`, error)
        }
      }
      this.showUploadDialog = false
      this.selectedFiles = []
      this.loadFiles()
    },

    async confirmCreate() {
      if (!this.projectId) {
        console.log('⚠️ projectId为空，无法创建文件')
        return
      }
      
      try {
        const parentPath = this.currentFolder ? this.currentFolder.file_path : null
        const response = await fetch(`http://39.108.142.250:3000/api/projects/${this.projectId}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_name: this.newFileName,
            file_type: this.newFileName.split('.').pop(),
            file_size: this.newFileContent.length,
            content: this.newFileContent,
            parent_path: parentPath,
            created_by: 'current_user'
          })
        })
        const result = await response.json()
        if (result.success) {
          this.showCreateDialog = false
          this.loadFiles()
        }
      } catch (error) {
        console.error('创建文件失败:', error)
      }
    },

    readFileContent(file) {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target.result)
        reader.readAsText(file)
      })
    },

    refreshFiles() {
      if (!this.projectId) {
        console.log('⚠️ projectId为空，无法刷新文件')
        return
      }
      this.loadFiles()
    },

    selectFile(file) {
      if (file.item_type === 'folder') {
        // 点击文件夹直接进入
        this.enterFolder(file)
      } else {
        this.currentFolder = null
        console.log('选择文件:', file)
        // 触发文件选择事件
        this.$emit('file-selected', file)
      }
    },

    enterFolder(folder) {
      this.currentFolder = folder
      this.breadcrumb.push(folder)
      this.loadFiles()
    },

    navigateToRoot() {
      this.currentFolder = null
      this.breadcrumb = []
      this.loadFiles()
    },

    navigateToFolder(folder) {
      const index = this.breadcrumb.findIndex(item => item.id === folder.id)
      if (index !== -1) {
        this.currentFolder = folder
        this.breadcrumb = this.breadcrumb.slice(0, index + 1)
        this.loadFiles()
      }
    },

    viewFile(file) {
      if (file.item_type === 'file') {
        alert(`文件内容:\n${file.content || '无内容'}`)
      }
    },

    async deleteFile(file) {
      if (!this.projectId) {
        console.log('⚠️ projectId为空，无法删除文件')
        return
      }
      
      if (confirm(`确定要删除 ${file.file_name} 吗？`)) {
        try {
          const response = await fetch(`http://39.108.142.250:3000/api/projects/${this.projectId}/items`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemPath: file.file_path })
          })
          const result = await response.json()
          
          // 检查HTTP状态码和响应结果
          if (response.ok && result.success) {
            console.log(`✅ 删除成功: ${file.file_name}`)
            this.loadFiles()
          } else {
            console.error(`❌ 删除失败: ${result.error || '未知错误'}`)
            // 如果文件已经被删除，也刷新列表
            if (result.error && result.error.includes('已经被删除')) {
              console.log('文件已被删除，刷新列表')
              this.loadFiles()
            }
          }
        } catch (error) {
          console.error('删除文件失败:', error)
        }
      }
    },

    getFileIcon(fileType) {
      const icons = {
        'js': '📜', 'ts': '📜', 'jsx': '⚛️', 'tsx': '⚛️',
        'vue': '💚', 'html': '🌐', 'css': '🎨', 'scss': '🎨',
        'json': '📋', 'md': '📝', 'txt': '📄'
      }
      return icons[fileType] || '📄'
    },

    formatBytes(bytes) {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }
  }
}
</script>

<style scoped>
.simple-file-manager {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
}

.breadcrumb {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  font-size: 14px;
}

.breadcrumb-item {
  cursor: pointer;
  color: #007bff;
  transition: color 0.2s;
}

.breadcrumb-item:hover {
  color: #0056b3;
  text-decoration: underline;
}

.breadcrumb-item.active {
  color: #495057;
  cursor: default;
}

.breadcrumb-item.active:hover {
  text-decoration: none;
}

.breadcrumb-separator {
  margin: 0 8px;
  color: #6c757d;
}

.toolbar {
  display: flex;
  gap: 8px;
  padding: 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: white;
}

.upload-btn { background: #28a745; }
.create-btn { background: #17a2b8; }
.folder-btn { background: #ffc107; color: #212529; }
.refresh-btn { background: #6c757d; }

.btn:hover {
  background: #0056b3;
}

.btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.btn:disabled:hover {
  background: #6c757d;
}

.file-tree {
  padding: 16px;
}

.file-tree h4 {
  margin: 0 0 16px 0;
  color: #495057;
}

.empty-files {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.files-list {
  max-height: 300px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.file-item:hover {
  background: #f8f9fa;
}

.file-item.selected {
  background: #e3f2fd;
  border-left: 3px solid #007bff;
}

.file-item.folder-item {
  background: #fff3cd;
  border-left: 3px solid #ffc107;
}

.file-item.folder-item:hover {
  background: #ffeaa7;
}

.file-icon {
  margin-right: 8px;
  font-size: 16px;
}

.file-name {
  flex: 1;
  font-weight: 500;
}

.file-size {
  margin-right: 8px;
  font-size: 12px;
  color: #6c757d;
}

.file-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.file-item:hover .file-actions {
  opacity: 1;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px;
  border-radius: 2px;
}

.action-btn:hover {
  background: #e9ecef;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 24px;
  border-radius: 8px;
  width: 90%;
  max-width: 400px;
}

.modal-content h3 {
  margin: 0 0 16px 0;
}

.modal-content input,
.modal-content textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  margin-bottom: 16px;
}

.modal-content textarea {
  resize: vertical;
  min-height: 100px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.modal-actions button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.modal-actions button:first-child {
  background: #6c757d;
  color: white;
}

.modal-actions button:last-child {
  background: #007bff;
  color: white;
}

.modal-actions button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}
</style>

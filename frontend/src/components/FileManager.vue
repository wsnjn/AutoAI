<template>
  <div class="file-manager">
    <!-- 文件操作工具�?-->
    <div class="file-toolbar">
      <div class="toolbar-left">
        <button @click="showUploadDialog" class="toolbar-btn upload-btn">
          📤 上传文件
        </button>
        <button @click="showCreateFileDialog" class="toolbar-btn create-btn">
          📄 创建文件
        </button>
        <button @click="showCreateFolderDialog" class="toolbar-btn folder-btn">
          📁 创建文件�?
        </button>
        <button @click="refreshFileTree" class="toolbar-btn refresh-btn">
          🔄 刷新
        </button>
      </div>
      <div class="toolbar-right">
        <span class="file-count">�?{{ totalFiles }} 个文�?/span>
      </div>
    </div>

    <!-- 文件树展�?-->
    <div class="file-tree-container">
      <div class="file-tree-header">
        <h4>📁 项目文件结构</h4>
      </div>
      <div class="file-tree">
        <div v-if="fileTree.length === 0" class="empty-tree">
          <p>📁 暂无文件</p>
          <p>点击上方按钮开始添加文�?/p>
        </div>
        <div v-else class="tree-items">
          <FileTreeNode
            v-for="item in fileTree"
            :key="item.id"
            :item="item"
            :project-id="projectId"
            @refresh="refreshFileTree"
          />
        </div>
      </div>
    </div>

    <!-- 文件上传对话�?-->
    <div v-if="showUpload" class="modal-overlay" @click="closeUploadDialog">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>📤 上传文件</h3>
          <button @click="closeUploadDialog" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="upload-area" @click="triggerFileInput">
            <input
              ref="fileInput"
              type="file"
              multiple
              @change="handleFileSelect"
              style="display: none"
            />
            <div class="upload-icon">📁</div>
            <p>点击选择文件</p>
          </div>
          <div v-if="selectedFiles.length > 0" class="selected-files">
            <h4>已选择的文�?</h4>
            <div v-for="file in selectedFiles" :key="file.name" class="selected-file">
              <span>{{ file.name }}</span>
              <span class="file-size">({{ formatBytes(file.size) }})</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeUploadDialog" class="cancel-btn">取消</button>
          <button @click="uploadFiles" class="confirm-btn" :disabled="uploading">
            {{ uploading ? '上传�?..' : '上传' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 创建文件对话�?-->
    <div v-if="showCreateFile" class="modal-overlay" @click="closeCreateFileDialog">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>📄 创建文件</h3>
          <button @click="closeCreateFileDialog" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>文件�?</label>
            <input
              v-model="newFileName"
              type="text"
              placeholder="例如: index.js, style.css"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label>文件内容:</label>
            <textarea
              v-model="newFileContent"
              placeholder="输入文件内容..."
              class="form-textarea"
              rows="8"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeCreateFileDialog" class="cancel-btn">取消</button>
          <button @click="createNewFile" class="confirm-btn" :disabled="creating">
            {{ creating ? '创建�?..' : '创建' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 创建文件夹对话框 -->
    <div v-if="showCreateFolder" class="modal-overlay" @click="closeCreateFolderDialog">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>📁 创建文件�?/h3>
          <button @click="closeCreateFolderDialog" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>文件夹名�?</label>
            <input
              v-model="newFolderName"
              type="text"
              placeholder="例如: src, components"
              class="form-input"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeCreateFolderDialog" class="cancel-btn">取消</button>
          <button @click="createNewFolder" class="confirm-btn" :disabled="creating">
            {{ creating ? '创建�?..' : '创建' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import FileTreeNode from './FileTreeNode.vue'

export default {
  name: 'FileManager',
  components: {
    FileTreeNode
  },
  props: {
    projectId: {
      type: String,
      required: true
    },
    projectName: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      fileTree: [],
      totalFiles: 0,
      showUpload: false,
      showCreateFile: false,
      showCreateFolder: false,
      selectedFiles: [],
      newFileName: '',
      newFileContent: '',
      newFolderName: '',
      uploading: false,
      creating: false
    }
  },
  mounted() {
    this.refreshFileTree()
  },
  methods: {
    // 刷新文件�?
    async refreshFileTree() {
      try {
        const response = await fetch(`http://39.108.142.250:3000/api/projects/${this.projectId}/files`)
        const result = await response.json()
        
        if (result.success) {
          this.fileTree = this.buildFileTree(result.data)
          this.totalFiles = result.data.length
          console.log('�?文件树刷新成�?', this.totalFiles, '个文�?)
        } else {
          console.error('�?刷新文件树失�?', result.error)
        }
      } catch (error) {
        console.error('�?刷新文件树失�?', error)
      }
    },

    // 构建文件树结�?
    buildFileTree(files) {
      const tree = []
      const fileMap = new Map()

      // 先创建所有文件的映射
      files.forEach(file => {
        fileMap.set(file.file_path, {
          ...file,
          children: [],
          expanded: false
        })
      })

      // 构建树结�?
      files.forEach(file => {
        const node = fileMap.get(file.file_path)
        if (file.parent_path) {
          const parent = fileMap.get(file.parent_path)
          if (parent) {
            parent.children.push(node)
          }
        } else {
          tree.push(node)
        }
      })

      return tree
    },

    // 显示上传对话�?
    showUploadDialog() {
      this.showUpload = true
      this.selectedFiles = []
    },

    // 关闭上传对话�?
    closeUploadDialog() {
      this.showUpload = false
      this.selectedFiles = []
    },

    // 触发文件选择
    triggerFileInput() {
      this.$refs.fileInput.click()
    },

    // 处理文件选择
    handleFileSelect(event) {
      this.selectedFiles = Array.from(event.target.files)
    },

    // 上传文件
    async uploadFiles() {
      if (this.selectedFiles.length === 0) return

      this.uploading = true
      try {
        for (const file of this.selectedFiles) {
          const fileData = {
            file_name: file.name,
            file_type: this.getFileExtension(file.name),
            file_size: file.size,
            content: await this.readFileContent(file),
            created_by: 'current_user'
          }

          const response = await fetch(`http://39.108.142.250:3000/api/projects/${this.projectId}/files`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(fileData)
          })

          const result = await response.json()
          if (result.success) {
            console.log(`�?文件 "${file.name}" 上传成功`)
          } else {
            console.error(`�?文件 "${file.name}" 上传失败:`, result.error)
          }
        }

        this.closeUploadDialog()
        this.refreshFileTree()
      } catch (error) {
        console.error('�?文件上传失败:', error)
      } finally {
        this.uploading = false
      }
    },

    // 读取文件内容
    readFileContent(file) {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target.result)
        reader.readAsText(file)
      })
    },

    // 获取文件扩展�?
    getFileExtension(filename) {
      return filename.split('.').pop().toLowerCase()
    },

    // 显示创建文件对话�?
    showCreateFileDialog() {
      this.showCreateFile = true
      this.newFileName = ''
      this.newFileContent = ''
    },

    // 关闭创建文件对话�?
    closeCreateFileDialog() {
      this.showCreateFile = false
      this.newFileName = ''
      this.newFileContent = ''
    },

    // 创建新文�?
    async createNewFile() {
      if (!this.newFileName.trim()) return

      this.creating = true
      try {
        const fileData = {
          file_name: this.newFileName,
          file_type: this.getFileExtension(this.newFileName),
          file_size: this.newFileContent.length,
          content: this.newFileContent,
          created_by: 'current_user'
        }

        const response = await fetch(`http://39.108.142.250:3000/api/projects/${this.projectId}/files`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(fileData)
        })

        const result = await response.json()
        if (result.success) {
          console.log(`�?文件 "${this.newFileName}" 创建成功`)
          this.closeCreateFileDialog()
          this.refreshFileTree()
        } else {
          console.error(`�?文件 "${this.newFileName}" 创建失败:`, result.error)
        }
      } catch (error) {
        console.error('�?创建文件失败:', error)
      } finally {
        this.creating = false
      }
    },

    // 显示创建文件夹对话框
    showCreateFolderDialog() {
      this.showCreateFolder = true
      this.newFolderName = ''
    },

    // 关闭创建文件夹对话框
    closeCreateFolderDialog() {
      this.showCreateFolder = false
      this.newFolderName = ''
    },

    // 创建新文件夹
    async createNewFolder() {
      if (!this.newFolderName.trim()) return

      this.creating = true
      try {
        const folderData = {
          file_name: this.newFolderName,
          created_by: 'current_user'
        }

        const response = await fetch(`http://39.108.142.250:3000/api/projects/${this.projectId}/folders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(folderData)
        })

        const result = await response.json()
        if (result.success) {
          console.log(`�?文件�?"${this.newFolderName}" 创建成功`)
          this.closeCreateFolderDialog()
          this.refreshFileTree()
        } else {
          console.error(`�?文件�?"${this.newFolderName}" 创建失败:`, result.error)
        }
      } catch (error) {
        console.error('�?创建文件夹失�?', error)
      } finally {
        this.creating = false
      }
    },

    // 格式化文件大�?
    formatBytes(bytes) {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }
  }
}
</script>

<style scoped>
.file-manager {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.file-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.toolbar-left {
  display: flex;
  gap: 8px;
}

.toolbar-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background: #007bff;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.toolbar-btn:hover {
  background: #0056b3;
}

.upload-btn { background: #28a745; }
.upload-btn:hover { background: #1e7e34; }

.create-btn { background: #17a2b8; }
.create-btn:hover { background: #117a8b; }

.folder-btn { background: #ffc107; color: #212529; }
.folder-btn:hover { background: #e0a800; }

.refresh-btn { background: #6c757d; }
.refresh-btn:hover { background: #545b62; }

.file-count {
  font-size: 14px;
  color: #6c757d;
}

.file-tree-container {
  padding: 16px;
}

.file-tree-header {
  margin-bottom: 16px;
}

.file-tree-header h4 {
  margin: 0;
  color: #495057;
}

.empty-tree {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.tree-items {
  max-height: 400px;
  overflow-y: auto;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e9ecef;
}

.modal-header h3 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
}

.modal-body {
  padding: 16px;
}

.upload-area {
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
}

.upload-area:hover {
  border-color: #007bff;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.selected-files {
  margin-top: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 4px;
}

.selected-file {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid #e9ecef;
}

.file-size {
  color: #6c757d;
  font-size: 12px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

.form-textarea {
  resize: vertical;
  min-height: 120px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #e9ecef;
}

.cancel-btn, .confirm-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-btn {
  background: #6c757d;
  color: white;
}

.confirm-btn {
  background: #007bff;
  color: white;
}

.confirm-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}
</style>

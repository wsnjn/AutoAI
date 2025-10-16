<template>
  <div class="file-tree-display">
                   <div class="tree-header">
                 <h4>🌳 项目文件树</h4>
                 <button @click="refreshTree" class="refresh-btn" :disabled="!projectId">🔄 刷新</button>
               </div>
    
    <div v-if="loading" class="loading">
      <p>加载文件树中...</p>
    </div>
    
    <div v-else-if="error" class="error">
      <p>❌ {{ error }}</p>
    </div>
    
    <div v-else-if="!projectId" class="empty-tree">
      <p>请先选择或创建项目</p>
    </div>
    
    <div v-else-if="fileTree.length === 0" class="empty-tree">
      <p>暂无文件，请先创建文件或文件夹</p>
    </div>
    
    <div v-else class="tree-container">
      <div class="tree-list">
        <FileTreeNode 
          v-for="item in fileTree" 
          :key="item.id"
          :item="item"
          :project-id="projectId"
          @refresh="$emit('refresh')"
          @file-selected="onFileSelected"
          @edit-item="$emit('edit-item', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import FileTreeNode from './FileTreeNode.vue'

export default {
  name: 'FileTreeDisplay',
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
      loading: false,
      error: null
    }
  },
  watch: {
    projectId: {
      handler(newProjectId) {
        if (newProjectId) {
          this.loadFileTree()
        } else {
          this.fileTree = []
          this.error = null
        }
      },
      immediate: true
    }
  },
  mounted() {
    // 只有在projectId存在时才加载数据
    if (this.projectId) {
      this.loadFileTree()
    }
  },
  methods: {
    async loadFileTree() {
      if (!this.projectId) {
        console.log('⚠️ projectId为空，跳过文件树加载')
        return
      }
      
      this.loading = true
      this.error = null
      
      try {
        const response = await fetch(`http://39.108.142.250:3000/api/projects/${this.projectId}/file-tree`)
        const result = await response.json()
        
        if (result.success) {
          this.fileTree = result.data
          console.log('✅ 文件树加载成功:', this.fileTree)
        } else {
          this.error = result.error || '加载文件树失败'
          console.error('❌ 文件树加载失败:', result.error)
        }
      } catch (error) {
        this.error = '网络错误，请检查连接'
        console.error('❌ 文件树加载错误:', error)
      } finally {
        this.loading = false
      }
    },
    
    refreshTree() {
      if (!this.projectId) {
        console.log('⚠️ projectId为空，无法刷新文件树')
        return
      }
      this.loadFileTree()
    },
    
    onFileSelected(file) {
      console.log('🔍 FileTreeDisplay onFileSelected called:', file)
      console.log('🔍 转发文件选择事件到父组件')
      this.$emit('file-selected', file)
    }
  }
}
</script>

<style scoped>
.file-tree-display {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
}

.tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.tree-header h4 {
  margin: 0;
  color: #495057;
}

.refresh-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.refresh-btn:hover {
  background: #5a6268;
}

.refresh-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.refresh-btn:disabled:hover {
  background: #6c757d;
}

.loading, .error, .empty-tree {
  padding: 40px 16px;
  text-align: center;
  color: #6c757d;
}

.error {
  color: #dc3545;
}

.tree-container {
  max-height: 400px;
  overflow-y: auto;
}

.tree-list {
  padding: 8px 0;
}
</style>

<template>
  <div class="file-tree-container">
    <div class="tree-header">
      <h3>📁 文件结构�?/h3>
      <div class="tree-controls">
        <button @click="expandAll" class="control-btn">展开全部</button>
        <button @click="collapseAll" class="control-btn">折叠全部</button>
        <button @click="refreshTree" class="control-btn">刷新</button>
      </div>
    </div>
    
    <div class="tree-content">
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>正在加载文件结构...</p>
      </div>
      
      <div v-else-if="error" class="error-message">
        <p>�?{{ error }}</p>
        <button @click="refreshTree" class="retry-btn">重试</button>
      </div>
      
      <div v-else-if="fileTree.length === 0" class="empty-state">
        <p>📂 暂无文件结构数据</p>
        <p>请先选择一个文件夹进行分析</p>
      </div>
      
      <div v-else class="tree-list">
        <div 
          v-for="item in fileTree" 
          :key="item.id"
          class="tree-item"
        >
          <FileTreeNode 
            :node="item" 
            :level="0"
            @node-click="handleNodeClick"
          />
        </div>
      </div>
    </div>
    
    <div class="tree-footer">
      <div class="tree-stats">
        <span>📄 文件: {{ fileCount }}</span>
        <span>📂 文件�? {{ folderCount }}</span>
        <span>💾 大小: {{ formatBytes(totalSize) }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import FileTreeNode from './FileTreeNode.vue'

export default {
  name: 'FileTree',
  components: {
    FileTreeNode
  },
  props: {
    folderPath: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      fileTree: [],
      loading: false,
      error: '',
      fileCount: 0,
      folderCount: 0,
      totalSize: 0
    }
  },
  watch: {
    folderPath: {
      handler(newPath) {
        if (newPath) {
          this.loadFileTree()
        }
      },
      immediate: true
    }
  },
  methods: {
    async loadFileTree() {
      if (!this.folderPath) return
      
      this.loading = true
      this.error = ''
      
      try {
        console.log('🌳 开始加载文件树...')
        const response = await fetch(`http://39.108.142.250:3000/api/folder-structure?path=${encodeURIComponent(this.folderPath)}`)
        const result = await response.json()
        
        if (result.success) {
          this.fileTree = result.data.fileTree
          this.calculateStats()
          console.log('�?文件树加载成�?', this.fileTree)
        } else {
          this.error = result.error || '加载失败'
          console.error('�?文件树加载失�?', result.error)
        }
      } catch (error) {
        this.error = `网络错误: ${error.message}`
        console.error('�?加载文件树失�?', error)
      } finally {
        this.loading = false
      }
    },
    
    calculateStats() {
      this.fileCount = 0
      this.folderCount = 0
      this.totalSize = 0
      
      const countStats = (items) => {
        items.forEach(item => {
          if (item.type === 'file') {
            this.fileCount++
            this.totalSize += item.size || 0
          } else if (item.type === 'directory') {
            this.folderCount++
          }
          
          if (item.children && item.children.length > 0) {
            countStats(item.children)
          }
        })
      }
      
      countStats(this.fileTree)
    },
    
    expandAll() {
      this.$emit('expand-all')
    },
    
    collapseAll() {
      this.$emit('collapse-all')
    },
    
    refreshTree() {
      this.loadFileTree()
    },
    
    handleNodeClick(node) {
      this.$emit('node-click', node)
    },
    
    formatBytes(bytes) {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }
  }
}
</script>

<style scoped>
.file-tree-container {
  background: white;
  border-radius: 15px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
}

.tree-header {
  padding: 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
  flex-shrink: 0;
}

.tree-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.2em;
}

.tree-controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.control-btn {
  padding: 8px 15px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.3s ease;
  white-space: nowrap;
}

.control-btn:hover {
  background: #5a6fd8;
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  min-height: 400px;
  width: 100%;
  box-sizing: border-box;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  text-align: center;
  color: #dc3545;
  padding: 40px 20px;
}

.retry-btn {
  margin-top: 15px;
  padding: 10px 20px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.retry-btn:hover {
  background: #c82333;
}

.empty-state {
  text-align: center;
  color: #666;
  padding: 40px 20px;
}

.empty-state p {
  margin: 10px 0;
}

.tree-list {
  font-family: 'Courier New', monospace;
  width: 100%;
}

.tree-footer {
  padding: 15px 20px;
  border-top: 1px solid #eee;
  background: #f8f9fa;
  flex-shrink: 0;
}

.tree-stats {
  display: flex;
  justify-content: space-around;
  font-size: 0.9em;
  color: #666;
  flex-wrap: wrap;
  gap: 10px;
}

.tree-stats span {
  display: flex;
  align-items: center;
  gap: 5px;
}

@media (max-width: 1200px) {
  .tree-header {
    padding: 15px;
  }
  
  .tree-content {
    padding: 15px;
  }
  
  .tree-footer {
    padding: 12px 15px;
  }
}

@media (max-width: 768px) {
  .tree-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
    padding: 15px;
  }
  
  .tree-controls {
    justify-content: center;
  }
  
  .tree-content {
    padding: 15px 10px;
  }
  
  .tree-stats {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }
  
  .tree-footer {
    padding: 10px 15px;
  }
}

@media (max-width: 480px) {
  .tree-header {
    padding: 12px;
  }
  
  .tree-content {
    padding: 12px 8px;
  }
  
  .tree-footer {
    padding: 8px 12px;
  }
  
  .control-btn {
    padding: 6px 12px;
    font-size: 11px;
  }
}
</style>

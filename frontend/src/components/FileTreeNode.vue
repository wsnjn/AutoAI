<template>
  <div class="file-tree-node">
    <div class="node-content" @click="toggleExpand">
      <div class="node-icon">
        <span v-if="item.item_type === 'folder'">📁</span>
        <span v-else>{{ getFileIcon(item.file_type) }}</span>
      </div>
      <div class="node-info">
        <div class="node-name">{{ item.file_name }}</div>
        <div class="node-meta">
          <span v-if="item.item_type === 'file'">{{ formatBytes(item.file_size) }}</span>
          <span v-else>{{ item.child_count }} 个项目</span>
        </div>
      </div>
      <div class="node-actions">
        <button @click.stop="viewItem" class="action-btn">👁️</button>
        <button @click.stop="editItem" class="action-btn">✏️</button>
        <button @click.stop="deleteItem" class="action-btn">🗑️</button>
      </div>
    </div>
    
    <div v-if="item.item_type === 'folder' && item.children && item.children.length > 0" 
         class="node-children" 
         :class="{ 'expanded': item.expanded }">
      <FileTreeNode
        v-for="child in item.children"
        :key="child.id"
        :item="child"
        :project-id="projectId"
        @refresh="$emit('refresh')"
        @file-selected="$emit('file-selected', $event)"
        @edit-item="$emit('edit-item', $event)"
      />
    </div>
  </div>
</template>

<script>
export default {
  name: 'FileTreeNode',
  props: {
    item: {
      type: Object,
      required: true
    },
    projectId: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      deleting: false
    }
  },
  computed: {
    deleteKey() {
      return `${this.projectId}-${this.item.file_path}`
    }
  },
  mounted() {
    // 默认展开文件夹
    if (this.item.item_type === 'folder') {
      this.item.expanded = true
    }
  },
  methods: {
    toggleExpand() {
      if (this.item.item_type === 'folder') {
        this.item.expanded = !this.item.expanded
      }
    },
    
    getFileIcon(fileType) {
      const iconMap = {
        'js': '📜',
        'ts': '📜',
        'jsx': '⚛️',
        'tsx': '⚛️',
        'vue': '💚',
        'html': '🌐',
        'css': '🎨',
        'scss': '🎨',
        'json': '📋',
        'md': '📝',
        'txt': '📄'
      }
      return iconMap[fileType] || '📄'
    },
    
    formatBytes(bytes) {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    },
    
    viewItem() {
      console.log('🔍 FileTreeNode viewItem clicked:', this.item)
      if (this.item.item_type === 'file') {
        console.log('✅ 发送文件选择事件:', this.item.file_name)
        this.$emit('view-file', this.item)
        this.$emit('file-selected', this.item)
      } else {
        console.log('❌ 不是文件类型，无法预览')
      }
    },
    
    editItem() {
      this.$emit('edit-item', this.item)
      // 如果是文件，也触发文件选择事件
      if (this.item.item_type === 'file') {
        this.$emit('file-selected', this.item)
      }
    },
    
    async deleteItem() {
      // 检查全局删除状态
      if (window.deletingFiles && window.deletingFiles.has(this.deleteKey)) {
        console.log('⚠️ 该文件正在被其他组件删除，跳过')
        return
      }
      
      if (this.deleting) {
        console.log('⚠️ 正在删除中，请勿重复操作')
        return
      }
      
      if (confirm(`确定要删除 "${this.item.file_name}" 吗？`)) {
        // 设置全局删除状态
        if (!window.deletingFiles) {
          window.deletingFiles = new Set()
        }
        window.deletingFiles.add(this.deleteKey)
        
        this.deleting = true
        try {
          const response = await fetch(`http://39.108.142.250:3000/api/projects/${this.projectId}/items`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              itemPath: this.item.file_path
            })
          })
          
          const result = await response.json()
          
          // 检查HTTP状态码和响应结果
          if (response.ok && result.success) {
            console.log(`✅ 删除成功: ${this.item.file_name}`)
            this.$emit('refresh')
          } else {
            console.error(`❌ 删除失败: ${result.error || '未知错误'}`)
            // 如果文件已经被删除，也刷新列表
            if (result.error && result.error.includes('已经被删除')) {
              console.log('文件已被删除，刷新列表')
              this.$emit('refresh')
            } else {
              // 显示错误提示
              alert(`删除失败: ${result.error || '未知错误'}`)
            }
          }
        } catch (error) {
          console.error('❌ 删除失败:', error)
          alert('删除失败: 网络错误')
        } finally {
          this.deleting = false
          // 清除全局删除状态
          if (window.deletingFiles) {
            window.deletingFiles.delete(this.deleteKey)
          }
        }
      }
    }
  }
}
</script>

<style scoped>
.file-tree-node {
  margin: 2px 0;
}

.node-content {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.node-content:hover {
  background: #f8f9fa;
}

.node-icon {
  margin-right: 8px;
  font-size: 16px;
}

.node-info {
  flex: 1;
  min-width: 0;
}

.node-name {
  font-weight: 500;
  color: #495057;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-meta {
  font-size: 12px;
  color: #6c757d;
  margin-top: 2px;
}

.node-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.node-content:hover .node-actions {
  opacity: 1;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px;
  border-radius: 2px;
  transition: background-color 0.2s;
}

.action-btn:hover {
  background: #e9ecef;
}

.node-children {
  margin-left: 20px;
  display: none;
}

.node-children.expanded {
  display: block;
}
</style>

<template>
  <div class="monitor-container">
    <div class="monitor-header">
      <h3>🔍 实时监控</h3>
      <div class="monitor-controls">
        <button 
          @click="toggleMonitoring" 
          :class="['monitor-btn', { 'active': isMonitoring }]"
          :disabled="!selectedFolder"
        >
          <span v-if="isMonitoring">停止监控</span>
          <span v-else>开始监�?/span>
        </button>
        <button @click="refreshChanges" class="refresh-btn" :disabled="isLoading">
          <span v-if="isLoading">刷新�?..</span>
          <span v-else>刷新</span>
        </button>
      </div>
    </div>
    
    <div class="monitor-status">
      <div class="status-item">
        <span class="status-label">监控状�?</span>
        <span :class="['status-value', { 'active': isMonitoring }]">
          {{ isMonitoring ? '监控�? : '已停�? }}
        </span>
      </div>
      <div class="status-item">
        <span class="status-label">变化数量:</span>
        <span class="status-value">{{ changes.length }}</span>
      </div>
      <div class="status-item">
        <span class="status-label">最后更�?</span>
        <span class="status-value">{{ lastUpdate }}</span>
      </div>
    </div>
    
    <div class="changes-section">
      <h4>📝 文件变化记录</h4>
      <div class="changes-list" ref="changesList">
        <div v-if="changes.length === 0" class="no-changes">
          <p>暂无文件变化记录</p>
        </div>
        <div 
          v-for="change in changes" 
          :key="change.id"
          :class="['change-item', getChangeTypeClass(change.action_type)]"
        >
          <div class="change-icon">
            {{ getChangeIcon(change.action_type) }}
          </div>
          <div class="change-content">
            <div class="change-description">
              {{ change.message }}
            </div>
            <div class="change-time">
              {{ formatTime(change.created_at) }}
            </div>
            <div v-if="change.details" class="change-details">
              <span v-if="change.details.filePath" class="detail-item">
                文件: {{ change.details.filePath }}
              </span>
              <span v-if="change.details.fileSize" class="detail-item">
                大小: {{ formatBytes(change.details.fileSize) }}
              </span>
              <span v-if="change.details.fileType" class="detail-item">
                类型: {{ change.details.fileType }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="auto-refresh">
      <label class="auto-refresh-label">
        <input 
          type="checkbox" 
          v-model="autoRefresh" 
          @change="toggleAutoRefresh"
        >
        自动刷新 (�?0�?
      </label>
    </div>
  </div>
</template>

<script>
export default {
  name: 'RealTimeMonitor',
  props: {
    selectedFolder: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      isMonitoring: false,
      isLoading: false,
      changes: [],
      lastUpdate: '未更�?,
      autoRefresh: false,
      refreshInterval: null
    }
  },
  mounted() {
    this.checkMonitoringStatus();
    this.loadChanges();
  },
  beforeUnmount() {
    this.stopAutoRefresh();
  },
  methods: {
    async toggleMonitoring() {
      if (!this.selectedFolder) {
        alert('请先选择文件�?);
        return;
      }
      
      try {
        this.isLoading = true;
        
        if (this.isMonitoring) {
          await this.stopMonitoring();
        } else {
          await this.startMonitoring();
        }
      } catch (error) {
        console.error('监控操作失败:', error);
        alert(`操作失败: ${error.message}`);
      } finally {
        this.isLoading = false;
      }
    },
    
    async startMonitoring() {
      const response = await fetch('http://39.108.142.250:3000/api/watch-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folderPath: this.selectedFolder
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.isMonitoring = true;
        console.log('�?文件夹监控已启动');
        this.loadChanges();
      } else {
        throw new Error(result.error);
      }
    },
    
    async stopMonitoring() {
      const response = await fetch('http://39.108.142.250:3000/api/unwatch-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folderPath: this.selectedFolder
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.isMonitoring = false;
        console.log('🛑 文件夹监控已停止');
      } else {
        throw new Error(result.error);
      }
    },
    
    async checkMonitoringStatus() {
      try {
        const response = await fetch('http://39.108.142.250:3000/api/watch-status');
        const result = await response.json();
        
        if (result.success) {
          this.isMonitoring = result.data.watchedFolders.includes(this.selectedFolder);
        }
      } catch (error) {
        console.error('检查监控状态失�?', error);
      }
    },
    
    async loadChanges() {
      if (!this.selectedFolder) return;
      
      try {
        this.isLoading = true;
        
        const response = await fetch(`http://39.108.142.250:3000/api/file-changes?path=${encodeURIComponent(this.selectedFolder)}&limit=20`);
        const result = await response.json();
        
        if (result.success) {
          this.changes = result.data;
          this.lastUpdate = new Date().toLocaleString('zh-CN');
          this.scrollToBottom();
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error('加载文件变化失败:', error);
      } finally {
        this.isLoading = false;
      }
    },
    
    async refreshChanges() {
      await this.loadChanges();
    },
    
    toggleAutoRefresh() {
      if (this.autoRefresh) {
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    },
    
    startAutoRefresh() {
      this.refreshInterval = setInterval(() => {
        this.loadChanges();
      }, 30000); // 30�?
    },
    
    stopAutoRefresh() {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
    },
    
    getChangeTypeClass(actionType) {
      const classMap = {
        'file_added': 'change-added',
        'file_changed': 'change-modified',
        'file_deleted': 'change-deleted',
        'directory_added': 'change-added',
        'directory_deleted': 'change-deleted'
      };
      return classMap[actionType] || 'change-default';
    },
    
    getChangeIcon(actionType) {
      const iconMap = {
        'file_added': '📄',
        'file_changed': '✏️',
        'file_deleted': '🗑�?,
        'directory_added': '📁',
        'directory_deleted': '🗑�?
      };
      return iconMap[actionType] || '📝';
    },
    
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleString('zh-CN');
    },
    
    formatBytes(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.changesList;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    }
  },
  
  watch: {
    selectedFolder() {
      this.checkMonitoringStatus();
      this.loadChanges();
    }
  }
}
</script>

<style scoped>
.monitor-container {
  background: white;
  border-radius: 15px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
  padding: 25px;
  width: 100%;
  box-sizing: border-box;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #f0f0f0;
}

.monitor-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.3em;
  display: flex;
  align-items: center;
  gap: 10px;
}

.monitor-controls {
  display: flex;
  gap: 10px;
}

.monitor-btn, .refresh-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.monitor-btn {
  background: #6c757d;
  color: white;
}

.monitor-btn.active {
  background: #dc3545;
}

.monitor-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.monitor-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-btn {
  background: #17a2b8;
  color: white;
}

.refresh-btn:hover:not(:disabled) {
  background: #138496;
  transform: translateY(-1px);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.monitor-status {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 25px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 10px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-label {
  color: #666;
  font-weight: 500;
}

.status-value {
  color: #333;
  font-weight: 600;
  font-family: monospace;
}

.status-value.active {
  color: #28a745;
}

.changes-section {
  margin-bottom: 20px;
}

.changes-section h4 {
  color: #333;
  margin-bottom: 15px;
  font-size: 1.1em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.changes-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 10px;
}

.no-changes {
  text-align: center;
  padding: 40px;
  color: #666;
}

.change-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  margin-bottom: 10px;
  border-radius: 8px;
  border-left: 4px solid;
  transition: background-color 0.2s ease;
}

.change-item:last-child {
  margin-bottom: 0;
}

.change-item.change-added {
  background: #d4edda;
  border-left-color: #28a745;
}

.change-item.change-modified {
  background: #fff3cd;
  border-left-color: #ffc107;
}

.change-item.change-deleted {
  background: #f8d7da;
  border-left-color: #dc3545;
}

.change-item.change-default {
  background: #e2e3e5;
  border-left-color: #6c757d;
}

.change-icon {
  font-size: 1.2em;
  flex-shrink: 0;
  margin-top: 2px;
}

.change-content {
  flex: 1;
  min-width: 0;
}

.change-description {
  font-weight: 600;
  color: #333;
  margin-bottom: 5px;
}

.change-time {
  font-size: 0.8em;
  color: #666;
  margin-bottom: 5px;
}

.change-details {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.detail-item {
  font-size: 0.8em;
  color: #666;
  background: rgba(255, 255, 255, 0.7);
  padding: 2px 8px;
  border-radius: 12px;
}

.auto-refresh {
  text-align: center;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.auto-refresh-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 0.9em;
  cursor: pointer;
}

.auto-refresh-label input[type="checkbox"] {
  margin: 0;
}

@media (max-width: 768px) {
  .monitor-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
  
  .monitor-controls {
    width: 100%;
    justify-content: center;
  }
  
  .monitor-status {
    grid-template-columns: 1fr;
  }
  
  .status-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  
  .change-details {
    flex-direction: column;
    gap: 5px;
  }
  
  .changes-list {
    max-height: 300px;
  }
}
</style>

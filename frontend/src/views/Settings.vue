<template>
  <div class="settings">
    <div class="page-header">
      <h1>🤖 AI助手配置</h1>
      <p>配置您的AI助手和系统设置</p>
    </div>
    
    <div class="settings-grid">
      <div class="settings-section">
        <h3>📊 系统状态</h3>
        <div class="status-item">
          <label>后端服务</label>
          <span :class="['status', backendStatus ? 'online' : 'offline']">
            {{ backendStatus ? '🟢 在线' : '🔴 离线' }}
          </span>
        </div>
        <div class="status-item">
          <label>AI服务</label>
          <span :class="['status', aiStatus ? 'online' : 'offline']">
            {{ aiStatus ? '🟢 正常' : '🔴 异常' }}
          </span>
        </div>
        <div class="status-item">
          <label>数据库</label>
          <span :class="['status', dbStatus ? 'online' : 'offline']">
            {{ dbStatus ? '🟢 连接' : '🔴 断开' }}
          </span>
        </div>
        <div class="setting-item">
          <label>检查服务状态</label>
          <button class="check-btn" @click="checkServices">检查状态</button>
        </div>
      </div>
    </div>
    
    <div class="settings-actions">
      <button class="test-btn" @click="testAI">🧪 测试AI</button>
    </div>
    
    <!-- 测试结果 -->
    <div v-if="testResult" class="test-result">
      <h4>AI测试结果</h4>
      <p>{{ testResult }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Settings',
  data() {
    return {
      backendStatus: false,
      aiStatus: false,
      dbStatus: false,
      testResult: ''
    }
  },
  
  mounted() {
    this.checkServices();
  },
  
  methods: {
    
    // 检查服务状态
    async checkServices() {
      try {
        // 检查后端服务
        const backendResponse = await fetch('http://39.108.142.250:3000/api/health', {
          method: 'GET',
          timeout: 3000
        }).catch(() => null);
        this.backendStatus = backendResponse?.ok || false;
        
        // 检查AI服务 - 只检查响应结果
        const aiResponse = await fetch('http://39.108.142.250:3000/api/ai/general-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'test' }),
          timeout: 5000
        }).catch(() => null);
        
        if (aiResponse?.ok) {
          try {
            const aiData = await aiResponse.json();
            this.aiStatus = aiData && typeof aiData === 'object' && 'response' in aiData;
          } catch {
            this.aiStatus = false;
          }
        } else {
          this.aiStatus = false;
        }
        
        // 检查数据库（通过项目列表API）
        const dbResponse = await fetch('http://39.108.142.250:3000/api/projects/user/1', {
          method: 'GET',
          timeout: 3000
        }).catch(() => null);
        this.dbStatus = dbResponse?.ok || false;
        
        console.log('服务状态检查完成:', {
          backend: this.backendStatus,
          ai: this.aiStatus,
          database: this.dbStatus
        });
        
      } catch (error) {
        console.error('检查服务状态失败:', error);
        this.backendStatus = false;
        this.aiStatus = false;
        this.dbStatus = false;
      }
    },
    
    // 测试AI功能
    async testAI() {
      this.testResult = '正在测试AI服务...';
      
      try {
        const response = await fetch('http://39.108.142.250:3000/api/ai/general-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'test'
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 只检查是否收到正确的响应结构
        if (data && typeof data === 'object' && 'response' in data) {
          this.testResult = '✅ AI服务正常 - 收到有效token响应';
          console.log('AI测试成功 - 响应结构:', Object.keys(data));
        } else {
          this.testResult = '⚠️ AI服务异常 - 响应格式不正确';
          console.log('AI测试失败 - 响应数据:', data);
        }
        
        // 不进行语音朗读，只显示测试结果
        
      } catch (error) {
        console.error('AI测试失败:', error);
        this.testResult = `❌ AI测试失败: ${error.message}`;
      }
    }
  }
}
</script>

<style scoped>
.settings {
  padding: 20px;
  color: #333;
}

.page-header {
  margin-bottom: 30px;
}

.page-header h1 {
  font-size: 2.5rem;
  margin: 0;
  background: linear-gradient(45deg, #23a6d5, #23d5ab);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 30px;
  margin-bottom: 30px;
}

.settings-section {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.settings-section h3 {
  margin: 0 0 20px 0;
  font-size: 1.3rem;
  color: #333;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid #eee;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item label {
  font-weight: 500;
  color: #333;
}

.setting-item input[type="text"],
.setting-item input[type="email"],
.setting-item select {
  padding: 8px 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.3s ease;
}

.setting-item input:focus,
.setting-item select:focus {
  border-color: #23a6d5;
}

.setting-item input[type="checkbox"] {
  width: 20px;
  height: 20px;
  accent-color: #23a6d5;
}


.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid #eee;
}

.status-item:last-child {
  border-bottom: none;
}

.status-item label {
  font-weight: 500;
  color: #333;
}

.status {
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
}

.status.online {
  color: #28a745;
  background: rgba(40, 167, 69, 0.1);
}

.status.offline {
  color: #dc3545;
  background: rgba(220, 53, 69, 0.1);
}

.check-btn, .test-btn {
  padding: 8px 16px;
  border: 1px solid #23a6d5;
  border-radius: 8px;
  background: transparent;
  color: #23a6d5;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.check-btn:hover, .test-btn:hover {
  background: #23a6d5;
  color: white;
}

.settings-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.test-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  background: linear-gradient(45deg, #23a6d5, #23d5ab);
  color: white;
}

.test-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(35, 166, 213, 0.3);
}

.test-result {
  margin-top: 30px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 15px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #23a6d5;
}

.test-result h4 {
  margin: 0 0 10px 0;
  color: #23a6d5;
}

.test-result p {
  margin: 0;
  line-height: 1.6;
  color: #333;
}

@media (max-width: 768px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
  
  .settings-actions {
    flex-direction: column;
  }
}
</style>

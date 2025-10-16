<template>
  <div class="ai-chat-container">
    <div class="chat-header">
      <h3>🤖 DeepSeek AI 助手</h3>
      <div class="chat-status">
        <span :class="['status-indicator', { 'online': isConnected }]"></span>
        {{ isConnected ? '已连接' : '连接中...' }}
      </div>
    </div>
    
    <div class="chat-messages" ref="messagesContainer">
      <div 
        v-for="(message, index) in messages" 
        :key="index"
        :class="['message', message.role]"
      >
        <div class="message-avatar">
          {{ message.role === 'user' ? '👤' : '🤖' }}
        </div>
        <div class="message-content">
          <div class="message-text" v-html="formatMessage(message.content)"></div>
          <div class="message-time">{{ formatTime(message.timestamp) }}</div>
          <div v-if="message.actions && message.actions.length > 0" class="message-actions">
            <div v-for="action in message.actions" :key="action.id" class="action-item">
              <span class="action-type">{{ action.type }}</span>
              <span class="action-description">{{ action.description }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="isLoading" class="message assistant">
        <div class="message-avatar">🤖</div>
        <div class="message-content">
          <div class="loading-indicator">
            <div class="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="chat-input-section">
      <div class="input-container">
        <textarea
          v-model="userInput"
          @keydown.enter.prevent="sendMessage"
          placeholder="请描述您想要实现的功能或修改要求..."
          class="chat-input"
          :disabled="isLoading"
          rows="3"
        ></textarea>
        <button 
          @click="sendMessage" 
          class="send-btn"
          :disabled="isLoading || !userInput.trim()"
        >
          <span v-if="!isLoading">发送</span>
          <span v-else>发送中...</span>
        </button>
      </div>
      
      <div class="quick-actions">
        <button 
          v-for="action in quickActions" 
          :key="action.id"
          @click="useQuickAction(action)"
          class="quick-action-btn"
          :disabled="isLoading"
        >
          {{ action.label }}
        </button>
      </div>
    </div>
    
    <div class="chat-info">
      <div class="info-item">
        <span class="info-label">当前项目:</span>
        <span class="info-value">{{ projectName || '未选择项目' }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">项目ID:</span>
        <span class="info-value">{{ projectId || '无' }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">AI状态</span>
        <span class="info-value">{{ isConnected ? '在线' : '离线' }}</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AIChatBox',
  props: {
    projectId: {
      type: String,
      default: null
    },
    projectName: {
      type: String,
      default: null
    }
  },
  data() {
    return {
      messages: [],
      userInput: '',
      isLoading: false,
      isConnected: false,
      quickActions: [
        { id: 1, label: '添加新功能', prompt: '请帮我添加一个新的功能模块' },
        { id: 2, label: '优化代码', prompt: '请帮我优化现有代码的性能和结构' },
        { id: 3, label: '修复Bug', prompt: '请帮我检查和修复代码中的问题' },
        { id: 4, label: '重构代码', prompt: '请帮我重构代码以提高可维护性' }
      ]
    }
  },
  mounted() {
    this.initializeChat();
  },
  methods: {
    initializeChat() {
      // 添加欢迎消息
      const projectInfo = this.projectName ? `项目 "${this.projectName}"` : '当前项目';
      this.messages.push({
        role: 'assistant',
        content: `您好！我是DeepSeek AI助手。我已经连接到您的${projectInfo}。我可以帮助您：\n\n✅ 添加新功能和模块\n✅ 优化现有代码\n✅ 修复代码问题\n✅ 重构代码结构\n✅ 提供技术建议\n✅ 管理项目文件\n\n请告诉我您想要实现什么功能？`,
        timestamp: new Date(),
        actions: []
      });
      
      this.isConnected = true;
    },
    
    async sendMessage() {
      if (!this.userInput.trim() || this.isLoading) return;
      
      const userMessage = {
        role: 'user',
        content: this.userInput,
        timestamp: new Date(),
        actions: []
      };
      
      this.messages.push(userMessage);
      const currentInput = this.userInput;
      this.userInput = '';
      this.isLoading = true;
      
      try {
        const response = await this.callDeepSeekAPI(currentInput);
        this.messages.push(response);
      } catch (error) {
        console.error('AI对话失败:', error);
        this.messages.push({
          role: 'assistant',
          content: '抱歉，AI服务暂时不可用，请稍后重试。',
          timestamp: new Date(),
          actions: []
        });
      } finally {
        this.isLoading = false;
        this.scrollToBottom();
      }
    },
    
    async callDeepSeekAPI(userMessage) {
      try {
        const response = await fetch('http://39.108.142.250:3000/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage,
            projectId: this.projectId,
            projectName: this.projectName,
            context: {
              previousMessages: this.messages.slice(-5) // 发送最近5条消息作为上下文
            }
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          return {
            role: 'assistant',
            content: result.data.response,
            timestamp: new Date(),
            actions: result.data.actions || []
          };
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        throw error;
      }
    },
    
    useQuickAction(action) {
      this.userInput = action.prompt;
      this.sendMessage();
    },
    
    formatMessage(content) {
      // 将代码块用markdown格式显示
      return content
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
    },
    
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    },
    
    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.messagesContainer;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    }
  },
  
  watch: {
    messages() {
      this.scrollToBottom();
    }
  }
}
</script>

<style scoped>
.ai-chat-container {
  background: white;
  border-radius: 15px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
  height: 100%;
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
}

.chat-header {
  padding: 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
  border-radius: 15px 15px 0 0;
}

.chat-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.2em;
}

.chat-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9em;
  color: #666;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #dc3545;
  transition: background 0.3s ease;
}

.status-indicator.online {
  background: #28a745;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.message {
  display: flex;
  gap: 12px;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2em;
  background: #f8f9fa;
  flex-shrink: 0;
}

.message-content {
  flex: 1;
  min-width: 0;
  max-width: calc(100% - 60px);
  overflow: hidden;
}

.message.user .message-content {
  text-align: right;
}

.message-text {
  background: #f8f9fa;
  padding: 12px 16px;
  border-radius: 18px;
  font-size: 0.9em;
  line-height: 1.4;
  color: #333;
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  display: inline-block;
}

.message.user .message-text {
  background: #667eea;
  color: white;
}

.message.assistant .message-text {
  background: #e3f2fd;
  color: #1976d2;
}

.message-time {
  font-size: 0.75em;
  color: #999;
  margin-top: 5px;
  text-align: right;
}

.message.user .message-time {
  text-align: left;
}

.message-actions {
  margin-top: 10px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 3px solid #28a745;
}

.action-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  font-size: 0.8em;
}

.action-type {
  background: #28a745;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7em;
  font-weight: 600;
}

.action-description {
  color: #666;
  flex: 1;
  margin-left: 10px;
}

.loading-indicator {
  padding: 12px 16px;
}

.typing-dots {
  display: flex;
  gap: 4px;
  align-items: center;
}

.typing-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(1) { animation-delay: -0.32s; }
.typing-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing {
  0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.chat-input-section {
  padding: 20px;
  border-top: 1px solid #eee;
  background: #f8f9fa;
  border-radius: 0 0 15px 15px;
}

.input-container {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.chat-input {
  flex: 1;
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 10px;
  font-size: 14px;
  resize: none;
  font-family: inherit;
  transition: border-color 0.3s ease;
}

.chat-input:focus {
  outline: none;
  border-color: #667eea;
}

.chat-input:disabled {
  background: #f8f9fa;
  cursor: not-allowed;
}

.send-btn {
  padding: 12px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.send-btn:hover:not(:disabled) {
  background: #5a6fd8;
  transform: translateY(-1px);
}

.send-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
}

.quick-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.quick-action-btn {
  padding: 8px 16px;
  background: #e9ecef;
  color: #495057;
  border: none;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.quick-action-btn:hover:not(:disabled) {
  background: #667eea;
  color: white;
  transform: translateY(-1px);
}

.quick-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chat-info {
  padding: 15px 20px;
  background: #f8f9fa;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: space-around;
  font-size: 0.8em;
  color: #666;
}

.info-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.info-label {
  font-weight: 500;
}

.info-value {
  color: #333;
  font-weight: 600;
}

/* 代码块样式 */
.message-text pre {
  background: #2d3748;
  color: #e2e8f0;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 10px 0;
  font-family: 'Courier New', monospace;
  font-size: 0.85em;
}

.message-text code {
  background: #f7fafc;
  color: #2d3748;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

.message-text pre code {
  background: none;
  color: inherit;
  padding: 0;
}

@media (max-width: 768px) {
  .ai-chat-container {
    height: 100%;
  }
  
  .chat-header {
    padding: 15px;
  }
  
  .chat-messages {
    padding: 15px;
  }
  
  .message-text {
    max-width: 90%;
    font-size: 0.85em;
  }
  
  .chat-input-section {
    padding: 15px;
  }
  
  .input-container {
    flex-direction: column;
  }
  
  .send-btn {
    align-self: flex-end;
  }
  
  .quick-actions {
    justify-content: center;
  }
  
  .chat-info {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }
}
</style>

<template>
  <div class="ai-chat">
    <div class="chat-header">
      <h1>🤖 AI代码助手</h1>
    </div>
    <div class="chat-container">
      <div class="chat-messages" ref="chatMessages" @scroll="handleScroll">
        <div v-for="message in messages" :key="message.id" 
             :class="['message', message.role]">
          <div class="message-content">
            <div class="message-text" v-html="formatMessage(message.content)"></div>
            <div class="message-time">{{ formatTime(message.timestamp) }}</div>
          </div>
    </div>
    
        <div v-if="isLoading" class="message assistant">
          <div class="message-content">
            <div class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
          </div>
        </div>
      
      <div class="chat-input-container">
        <div class="input-wrapper">
          <textarea 
            v-model="userInput" 
            @keydown.enter.prevent="handleSend"
            @keydown.enter.shift.exact="handleSend"
            placeholder="输入您的问题或需求..."
            :disabled="isLoading"
            rows="2"
            class="chat-input"
          ></textarea>
          <button 
            @click="handleSend" 
            :disabled="!userInput.trim() || isLoading"
            class="send-btn"
          >
            <span v-if="!isLoading">发送</span>
            <span v-else>发送中...</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AIChat',
  data() {
    return {
      messages: [
        {
          id: 1,
          role: 'assistant',
          content: '👋 您好！我是您的AI代码助手，基于DeepSeek技术。我可以帮助您：\n\n✅ 分析和优化代码\n✅ 创建新文件\n✅ 修改现有文件\n✅ 回答编程问题\n✅ 提供技术建议\n✅ 解释代码逻辑\n✅ 调试问题\n\n请告诉我您需要什么帮助！',
          timestamp: new Date()
        }
      ],
      userInput: '',
      isLoading: false,
      messageId: 2,
      userId: null, // 当前用户ID
      isUserScrolling: false // 用户是否正在滚动
    }
  },
  methods: {
    // 获取当前登录用户信息
    getCurrentUser() {
      try {
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
          const user = JSON.parse(currentUser);
          this.userId = user.id || user.username || 'default_user';
          console.log('✅ 获取当前用户ID:', this.userId);
        } else {
          this.userId = 'default_user';
          console.log('⚠️ 未找到登录用户，使用默认用户ID:', this.userId);
        }
      } catch (error) {
        console.error('❌ 获取用户信息失败:', error);
        this.userId = 'default_user';
      }
    },
    
    async handleSend() {
      console.log('🚀 handleSend 被调用');
      console.log('📝 用户输入:', this.userInput);
      console.log('⏳ 加载状态:', this.isLoading);
      
      if (!this.userInput.trim() || this.isLoading) {
        console.log('⚠️ 发送条件不满足，退出');
        return;
      }
      
      const userMessage = {
        id: this.messageId++,
        role: 'user',
        content: this.userInput.trim(),
        timestamp: new Date()
      };
      
      console.log('💬 创建用户消息:', userMessage);
      this.messages.push(userMessage);
      console.log('📊 当前消息数量:', this.messages.length);
      
      this.userInput = '';
      this.isLoading = true;
      
      // 立即滚动到用户消息
      this.scrollToBottom(true);
      
      try {
        const response = await this.sendToAI(userMessage.content);
        
        const aiMessage = {
          id: this.messageId++,
          role: 'assistant',
          content: response,
          timestamp: new Date()
        };
        
        this.messages.push(aiMessage);
      } catch (error) {
        console.error('AI对话错误:', error);
        const errorMessage = {
          id: this.messageId++,
          role: 'assistant',
          content: '❌ 抱歉，AI服务暂时不可用。请稍后重试。',
          timestamp: new Date()
        };
        this.messages.push(errorMessage);
      } finally {
        this.isLoading = false;
        this.$nextTick(() => {
          this.scrollToBottom(true);
        });
      }
    },
    
    async sendToAI(message) {
      console.log('🤖 sendToAI 被调用，消息:', message);
      try {
        const response = await fetch('http://39.108.142.250:3000/api/ai/general-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: message,
            userId: this.userId
          })
        });
        
        console.log('📡 API响应状态:', response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📄 API响应数据:', data);
        
        return data.response || '抱歉，没有收到有效回复。';
      } catch (error) {
        console.error('❌ 发送AI请求失败:', error);
        throw error;
      }
    },
    
    formatMessage(content) {
      // 简单的markdown格式化
      return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/\n/g, '<br>');
    },
    
    formatTime(timestamp) {
      return timestamp.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    },
    
    scrollToBottom(force = false) {
      // 如果用户正在滚动且不是强制滚动，则不自动滚动
      if (this.isUserScrolling && !force) {
        return;
      }
      
      this.$nextTick(() => {
        const container = this.$refs.chatMessages;
        if (container) {
          // 检查是否已经在底部附近
          const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 100;
          
          // 只有在底部附近或强制滚动时才滚动
          if (isNearBottom || force) {
            // 使用平滑滚动到最新消息
            container.scrollTo({
              top: container.scrollHeight,
              behavior: 'smooth'
            });
            
            // 备用方案：如果平滑滚动不支持，使用传统方式
            setTimeout(() => {
              container.scrollTop = container.scrollHeight;
            }, 100);
          }
        }
      });
    },
    
    // 检测用户滚动行为
    handleScroll() {
      const container = this.$refs.chatMessages;
      if (container) {
        const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 10;
        this.isUserScrolling = !isAtBottom;
      }
    },
    
    // 加载聊天历史记录
    async loadChatHistory() {
      try {
        // 确保用户ID已获取
        if (!this.userId) {
          console.log('⏳ 等待用户ID获取...');
          return;
        }
        
        console.log(`📚 加载用户 ${this.userId} 的对话记录`);
        
        const response = await fetch(`http://39.108.142.250:3000/api/ai/chathistory/${this.userId}`);
        
        if (!response.ok) {
          console.warn('获取聊天历史失败:', response.status);
          return;
        }
        
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
          console.log(`📊 加载了用户 ${this.userId} 的 ${data.data.length} 条历史记录`);
          
          // 清空当前消息（除了欢迎消息）
          this.messages = [this.messages[0]];
          
          // 添加历史记录到消息列表
          data.data.forEach(record => {
            // 添加用户消息
            this.messages.push({
              id: this.messageId++,
              role: 'user',
              content: record.user_message,
              timestamp: new Date(record.created_at)
            });
            
            // 添加AI回答
            this.messages.push({
              id: this.messageId++,
              role: 'assistant',
              content: record.ai_response,
              timestamp: new Date(record.created_at)
            });
          });
          
          // 滚动到底部
          this.$nextTick(() => {
            this.scrollToBottom(true);
          });
        }
      } catch (error) {
        console.error('加载聊天历史失败:', error);
      }
    },
    
    // 处理来自3D模型的AI回答
    handleAIResponse(data) {
      console.log('收到3D模型的AI回答:', data);
      
      // 添加用户问题到聊天记录
      const userMessage = {
        id: this.messageId++,
        role: 'user',
        content: `🎤 ${data.question}`,
        timestamp: data.timestamp
      };
      this.messages.push(userMessage);
      
      // 添加AI回答到聊天记录
      const aiMessage = {
        id: this.messageId++,
        role: 'assistant',
        content: data.answer,
        timestamp: new Date()
      };
      this.messages.push(aiMessage);
      
      // 滚动到底部
      this.$nextTick(() => {
        this.scrollToBottom(true);
      });
    }
  },
  
  watch: {
    // 监听消息变化，自动滚动到底部
    messages: {
      handler() {
        // 新消息时强制滚动到底部
        this.scrollToBottom(true);
      },
      deep: true
    }
  },
  
  async mounted() {
    // 获取当前登录用户信息
    this.getCurrentUser();
    this.scrollToBottom(true);
    
    // 等待用户ID获取后再加载历史
    await this.$nextTick();
    this.loadChatHistory();
    
    // 监听3D模型的AI回答事件
    this.$root.$on('ai-response', this.handleAIResponse);
  },
  
  beforeUnmount() {
    // 移除事件监听
    this.$root.$off('ai-response', this.handleAIResponse);
  }
}
</script>

<style scoped>
.ai-chat {
  display: flex;
  flex-direction: column;
  color: #333;
  height: calc(100vh - 60px);
  width: 100%;
  padding: 0;
}

.chat-header {
  background: rgba(255, 255, 255, 0.95);
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 100%;
  flex-shrink: 0;
}

.chat-header h1 {
  margin: 0 0 10px 0;
  font-size: 2.5rem;
  background: linear-gradient(45deg, #23a6d5, #23d5ab);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.chat-header p {
  margin: 0;
  color: #666;
  font-size: 1.1rem;
}


.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 0;
  overflow: hidden;
  margin: 0;
  height: 100%;
}

.chat-messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
  min-height: 200px;
}

.message {
  display: flex;
  margin-bottom: 15px;
}

.message.user {
  justify-content: flex-end;
}

.message.assistant {
  justify-content: flex-start;
}

.message-content {
  max-width: 70%;
  padding: 15px 20px;
  border-radius: 20px;
  position: relative;
}

.message.user .message-content {
  background: linear-gradient(45deg, #23a6d5, #23d5ab);
  color: white;
  border-bottom-right-radius: 5px;
}

.message.assistant .message-content {
  background: #f8f9fa;
  color: #333;
  border: 1px solid #e9ecef;
  border-bottom-left-radius: 5px;
}

.message-text {
  line-height: 1.6;
  word-wrap: break-word;
}

.message-text code {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}

.message-text pre {
  background: #f8f9fa;
  padding: 10px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 10px 0;
}

.message-text pre code {
  background: none;
  padding: 0;
}

.message-time {
  font-size: 0.8rem;
  opacity: 0.7;
  margin-top: 8px;
  text-align: right;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  align-items: center;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #23a6d5;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}

.chat-input-container {
  padding: 20px;
  background: white;
  border-top: 1px solid #e9ecef;
  flex-shrink: 0;
  width: 100%;
}

.input-wrapper {
  display: flex;
  gap: 15px;
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  border: 2px solid #e9ecef;
  border-radius: 15px;
  padding: 15px;
  font-size: 1rem;
  resize: none;
  outline: none;
  transition: border-color 0.3s ease;
  font-family: inherit;
}

.chat-input:focus {
  border-color: #23a6d5;
}

.chat-input:disabled {
  background: #f8f9fa;
  cursor: not-allowed;
}

.send-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 15px;
  background: linear-gradient(45deg, #23a6d5, #23d5ab);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  height: fit-content;
}

.send-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(35, 166, 213, 0.3);
}

.send-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 响应式设置 */
@media (max-width: 768px) {
  .chat-header h1 {
    font-size: 2rem;
  }
  
  .message-content {
    max-width: 85%;
  }
  
  .input-wrapper {
    flex-direction: column;
  gap: 10px;
}

  .send-btn {
    width: 100%;
  }
}
</style>

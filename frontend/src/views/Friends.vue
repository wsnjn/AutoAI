<template>
  <div class="friends-container">
    <div class="friends-header">
      <h1>好友聊天</h1>
      <button class="add-friend-btn" @click="showAddFriendModal = true">添加好友</button>
    </div>
    
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>正在加载好友列表...</p>
    </div>
    
    <div v-else class="friends-content">
      <!-- 左侧：好友列表 -->
      <div class="friends-sidebar">
        <div class="sidebar-section">
          <h3>好友列表 ({{ friends.length }})</h3>
          <div v-if="friends.length === 0" class="empty-friends">
            <p>暂无好友</p>
            <button class="add-friend-btn small" @click="showAddFriendModal = true">添加好友</button>
          </div>
          <div v-else class="friends-list">
            <div 
              v-for="friend in friends" 
              :key="friend.friend_id"
              class="friend-item"
              :class="{ active: selectedFriend?.friend_id === friend.friend_id }"
              @click="selectFriend(friend)"
            >
              <div class="friend-avatar">{{ friend.username.charAt(0).toUpperCase() }}</div>
              <div class="friend-info">
                <div class="friend-name">{{ friend.username }}</div>
                <div class="friend-status">在线</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="sidebar-section">
          <h3>待处理好友请求 ({{ pendingRequests.length }})</h3>
          <div v-if="pendingRequests.length === 0" class="empty-requests">
            <p>暂无待处理请求</p>
          </div>
          <div v-else class="pending-requests">
            <div v-for="request in pendingRequests" :key="request.id" class="request-item">
              <div class="request-info">
                <div class="request-avatar">{{ request.username.charAt(0).toUpperCase() }}</div>
                <div class="request-details">
                  <div class="request-name">{{ request.username }}</div>
                  <div class="request-time">{{ formatDate(request.created_at) }}</div>
                </div>
              </div>
              <div class="request-actions">
                <button class="accept-btn" @click="respondToRequest(request.user_id, 'accept')">接受</button>
                <button class="reject-btn" @click="respondToRequest(request.user_id, 'reject')">拒绝</button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="sidebar-section">
          <h3>项目邀请 ({{ invitations.length }})</h3>
          <div v-if="invitations.length === 0" class="empty-invitations">
            <p>暂无项目邀请</p>
          </div>
          <div v-else class="invitations-list">
            <div v-for="invitation in invitations" :key="invitation.id" class="invitation-item">
              <div class="invitation-info">
                <div class="invitation-project">{{ invitation.project_name }}</div>
                <div class="invitation-inviter">来自: {{ invitation.inviter_name }}</div>
                <div class="invitation-message">{{ invitation.message || '邀请您加入项目' }}</div>
              </div>
              <div class="invitation-actions">
                <button class="accept-btn" @click="respondToInvitation(invitation.id, 'accept')">接受</button>
                <button class="reject-btn" @click="respondToInvitation(invitation.id, 'reject')">拒绝</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 右侧：聊天区域 -->
      <div class="chat-area">
        <div v-if="!selectedFriend" class="no-chat-selected">
          <div class="no-chat-icon">💬</div>
          <h3>选择一个好友开始聊天</h3>
          <p>从左侧好友列表中选择一个好友开始对话</p>
        </div>
        
        <div v-else class="chat-container">
          <!-- 聊天头部 -->
          <div class="chat-header">
            <div class="chat-friend-info">
              <div class="chat-avatar">{{ selectedFriend.username.charAt(0).toUpperCase() }}</div>
              <div class="chat-details">
                <div class="chat-name">{{ selectedFriend.username }}</div>
                <div class="chat-status">在线</div>
              </div>
            </div>
          </div>
          
          <!-- 聊天消息 -->
          <div class="chat-messages" ref="chatMessages">
            <div v-if="chatMessages.length === 0" class="no-messages">
              <p>开始与 {{ selectedFriend.username }} 的对话</p>
            </div>
            <div v-else>
              <div 
                v-for="message in chatMessages" 
                :key="message.id"
                class="message-item"
                :class="{ 'own-message': message.sender_id === currentUser.id }"
              >
                <div class="message-content">
                  <div class="message-text">{{ message.message }}</div>
                  <div class="message-time">{{ formatTime(message.created_at) }}</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 消息输入 -->
          <div class="chat-input">
            <input 
              type="text" 
              v-model="newMessage"
              @keyup.enter="sendMessage"
              placeholder="输入消息..."
              class="message-input"
            >
            <button @click="sendMessage" class="send-btn" :disabled="!newMessage.trim()">发送</button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 添加好友模态框 -->
    <div v-if="showAddFriendModal" class="modal-overlay" @click="closeAddFriendModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>添加好友</h3>
          <button class="close-btn" @click="closeAddFriendModal">×</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>好友用户名</label>
            <input 
              type="text" 
              v-model="addFriendForm.username" 
              placeholder="请输入好友的用户名"
              class="form-input"
            >
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeAddFriendModal">取消</button>
          <button class="btn-confirm" @click="addFriend" :disabled="!addFriendForm.username.trim()">
            发送好友请求
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Friends',
  data() {
    return {
      loading: true,
      friends: [],
      pendingRequests: [],
      invitations: [],
      selectedFriend: null,
      chatMessages: [],
      newMessage: '',
      showAddFriendModal: false,
      addFriendForm: {
        username: ''
      },
      currentUser: null
    }
  },
  
  async mounted() {
    await this.loadCurrentUser()
    await this.loadFriendsData()
  },
  
  methods: {
    async loadCurrentUser() {
      const currentUser = localStorage.getItem('currentUser')
      if (!currentUser) {
        this.$router.push('/auth')
        return
      }
      
      this.currentUser = JSON.parse(currentUser)
    },
    
    async loadFriendsData() {
      try {
        this.loading = true
        
        // 并行加载所有数据
        await Promise.all([
          this.loadFriends(),
          this.loadPendingRequests(),
          this.loadInvitations()
        ])
      } catch (error) {
        console.error('加载好友数据失败:', error)
      } finally {
        this.loading = false
      }
    },
    
    async loadFriends() {
      try {
        const response = await fetch(`http://39.108.142.250:3000/api/friends/${this.currentUser.id}`)
        const result = await response.json()
        
        if (result.success) {
          this.friends = result.data || []
        }
      } catch (error) {
        console.error('加载好友列表失败:', error)
      }
    },
    
    async loadPendingRequests() {
      try {
        const response = await fetch(`http://39.108.142.250:3000/api/friends/pending/${this.currentUser.id}`)
        const result = await response.json()
        
        if (result.success) {
          this.pendingRequests = result.data || []
        }
      } catch (error) {
        console.error('加载待处理好友请求失败:', error)
      }
    },
    
    async loadInvitations() {
      try {
        const response = await fetch(`http://39.108.142.250:3000/api/invitations/${this.currentUser.id}`)
        const result = await response.json()
        
        if (result.success) {
          this.invitations = result.data || []
        }
      } catch (error) {
        console.error('加载项目邀请失败:', error)
      }
    },
    
    async selectFriend(friend) {
      this.selectedFriend = friend
      await this.loadChatMessages(friend.friend_id)
    },
    
    async loadChatMessages(friendId) {
      try {
        const response = await fetch(`http://39.108.142.250:3000/api/friends/chat/${this.currentUser.id}/${friendId}`)
        const result = await response.json()
        
        if (result.success) {
          this.chatMessages = result.data || []
          this.$nextTick(() => {
            this.scrollToBottom()
          })
        }
      } catch (error) {
        console.error('加载聊天记录失败:', error)
      }
    },
    
    async sendMessage() {
      if (!this.newMessage.trim() || !this.selectedFriend) return
      
      try {
        const response = await fetch('http://39.108.142.250:3000/api/friends/chat/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            senderId: this.currentUser.id,
            receiverId: this.selectedFriend.friend_id,
            message: this.newMessage.trim()
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          this.newMessage = ''
          await this.loadChatMessages(this.selectedFriend.friend_id)
        } else {
          alert('发送消息失败: ' + result.error)
        }
      } catch (error) {
        console.error('发送消息失败:', error)
        alert('发送消息失败')
      }
    },
    
    async addFriend() {
      if (!this.addFriendForm.username.trim()) return
      
      try {
        const response = await fetch('http://39.108.142.250:3000/api/friends/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: this.currentUser.id,
            friendUsername: this.addFriendForm.username.trim()
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          alert('好友请求发送成功')
          this.closeAddFriendModal()
          await this.loadPendingRequests()
        } else {
          alert('添加好友失败: ' + result.error)
        }
      } catch (error) {
        console.error('添加好友失败:', error)
        alert('添加好友失败')
      }
    },
    
    async respondToRequest(friendId, action) {
      try {
        const response = await fetch('http://39.108.142.250:3000/api/friends/respond', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: this.currentUser.id,
            friendId: friendId,
            action: action
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          alert(`好友请求${action === 'accept' ? '接受' : '拒绝'}成功`)
          await this.loadFriendsData()
        } else {
          alert('处理好友请求失败: ' + result.error)
        }
      } catch (error) {
        console.error('处理好友请求失败:', error)
        alert('处理好友请求失败')
      }
    },
    
    async respondToInvitation(invitationId, action) {
      try {
        const response = await fetch('http://39.108.142.250:3000/api/invitations/respond', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            invitationId: invitationId,
            action: action
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          alert(`项目邀请${action === 'accept' ? '接受' : '拒绝'}成功`)
          await this.loadInvitations()
        } else {
          alert('处理项目邀请失败: ' + result.error)
        }
      } catch (error) {
        console.error('处理项目邀请失败:', error)
        alert('处理项目邀请失败')
      }
    },
    
    closeAddFriendModal() {
      this.showAddFriendModal = false
      this.addFriendForm.username = ''
    },
    
    scrollToBottom() {
      const chatMessages = this.$refs.chatMessages
      if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight
      }
    },
    
    formatDate(dateString) {
      const date = new Date(dateString)
      return date.toLocaleDateString('zh-CN')
    },
    
    formatTime(dateString) {
      const date = new Date(dateString)
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
  }
}
</script>

<style scoped>
.friends-container {
  padding: 20px;
  color: #333;
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
}

.friends-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.friends-header h1 {
  font-size: 2rem;
  margin: 0;
  color: #333;
}

.add-friend-btn {
  background: #23a6d5;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.add-friend-btn:hover {
  background: #1e8bb8;
  transform: translateY(-1px);
}

.add-friend-btn.small {
  padding: 6px 12px;
  font-size: 12px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #23a6d5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.friends-content {
  display: flex;
  flex: 1;
  gap: 20px;
  min-height: 0;
}

.friends-sidebar {
  width: 300px;
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
}

.sidebar-section {
  margin-bottom: 30px;
}

.sidebar-section h3 {
  font-size: 1.1rem;
  margin-bottom: 15px;
  color: #333;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 8px;
}

.empty-friends,
.empty-requests,
.empty-invitations {
  text-align: center;
  padding: 20px;
  color: #666;
}

.friends-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.friend-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.friend-item:hover {
  background: #f8f9fa;
}

.friend-item.active {
  background: #e3f2fd;
  border: 1px solid #23a6d5;
}

.friend-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #23a6d5;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 12px;
}

.friend-info {
  flex: 1;
}

.friend-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}

.friend-status {
  font-size: 0.8rem;
  color: #27ae60;
}

.pending-requests,
.invitations-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.request-item,
.invitation-item {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #e9ecef;
}

.request-info,
.invitation-info {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.request-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #6c757d;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.9rem;
  margin-right: 10px;
}

.request-details {
  flex: 1;
}

.request-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}

.request-time {
  font-size: 0.8rem;
  color: #666;
}

.invitation-project {
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}

.invitation-inviter {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 4px;
}

.invitation-message {
  font-size: 0.8rem;
  color: #888;
}

.request-actions,
.invitation-actions {
  display: flex;
  gap: 8px;
}

.accept-btn,
.reject-btn {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.3s ease;
}

.accept-btn {
  background: #27ae60;
  color: white;
}

.reject-btn {
  background: #e74c3c;
  color: white;
}

.accept-btn:hover {
  background: #229954;
}

.reject-btn:hover {
  background: #c0392b;
}

.chat-area {
  flex: 1;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.no-chat-selected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #666;
}

.no-chat-icon {
  font-size: 4rem;
  margin-bottom: 20px;
}

.no-chat-selected h3 {
  margin-bottom: 10px;
  color: #333;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-header {
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
  border-radius: 12px 12px 0 0;
}

.chat-friend-info {
  display: flex;
  align-items: center;
}

.chat-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #23a6d5;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 12px;
}

.chat-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}

.chat-status {
  font-size: 0.9rem;
  color: #27ae60;
}

.chat-messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: #fafafa;
}

.no-messages {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
}

.message-item {
  margin-bottom: 15px;
  display: flex;
  justify-content: flex-start;
}

.message-item.own-message {
  justify-content: flex-end;
}

.message-content {
  max-width: 70%;
  background: white;
  padding: 12px 16px;
  border-radius: 18px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.own-message .message-content {
  background: #23a6d5;
  color: white;
}

.message-text {
  margin-bottom: 4px;
  line-height: 1.4;
}

.message-time {
  font-size: 0.7rem;
  opacity: 0.7;
}

.chat-input {
  padding: 20px;
  border-top: 1px solid #e9ecef;
  background: white;
  border-radius: 0 0 12px 12px;
  display: flex;
  gap: 12px;
}

.message-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e9ecef;
  border-radius: 25px;
  font-size: 14px;
  transition: border-color 0.3s ease;
}

.message-input:focus {
  outline: none;
  border-color: #23a6d5;
}

.send-btn {
  background: #23a6d5;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 25px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.send-btn:hover:not(:disabled) {
  background: #1e8bb8;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e1e5e9;
}

.modal-header h3 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e1e5e9;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #23a6d5;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #e1e5e9;
}

.btn-cancel {
  background: #6c757d;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-confirm {
  background: #23a6d5;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-cancel:hover {
  background: #5a6268;
}

.btn-confirm:hover {
  background: #1e8bb8;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

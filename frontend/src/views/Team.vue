<template>
  <div class="team-container">
    <div class="team-header">
      <h1>团队管理</h1>
      <p>管理您创建的项目成员</p>
    </div>
    
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>正在加载团队数据...</p>
    </div>
    
    <div v-else>
      <div v-if="myProjects.length === 0" class="empty-state">
        <div class="empty-icon">👥</div>
        <h3>暂无创建的项目</h3>
        <p>您还没有创建任何项目，无法进行团队管理</p>
        <button class="create-project-btn" @click="goToCreateProject">创建项目</button>
      </div>
      
      <div v-else class="projects-list">
        <div v-for="project in myProjects" :key="project.id" class="project-card">
          <div class="project-header">
            <div class="project-info">
              <div class="project-icon">{{ getProjectIcon(project.type) }}</div>
              <div class="project-details">
                <h3 class="project-name">{{ project.name }}</h3>
                <p class="project-description">{{ project.description || '暂无描述' }}</p>
                <div class="project-meta">
                  <span class="project-type">{{ getProjectTypeName(project.type) }}</span>
                  <span class="project-date">创建于 {{ formatDate(project.created_at) }}</span>
                </div>
              </div>
            </div>
            <div class="project-actions">
              <button class="action-btn primary" @click="toggleProjectMembers(project.id)">
                {{ expandedProjects.includes(project.id) ? '收起' : '管理成员' }}
              </button>
            </div>
          </div>
          
          <!-- 成员列表 -->
          <div v-if="expandedProjects.includes(project.id)" class="members-section">
            <div class="members-header">
              <h4>项目成员 ({{ project.members?.length || 0 }})</h4>
              <button class="invite-btn" @click="showInviteModal(project)">邀请成员</button>
            </div>
            
            <div v-if="!project.members || project.members.length === 0" class="no-members">
              <p>暂无成员</p>
    </div>
    
            <div v-else class="members-list">
              <div v-for="member in project.members" :key="member.id" class="member-item">
            <div class="member-info">
                  <div class="member-avatar">{{ member.avatar || '👤' }}</div>
                  <div class="member-details">
                    <div class="member-name">{{ member.username }}</div>
                    <div class="member-role" :class="member.role">
                      {{ getRoleText(member.role) }}
            </div>
                    <div class="member-status" :class="member.status">
                      {{ getStatusText(member.status) }}
          </div>
        </div>
      </div>
      
                <div class="member-actions">
                  <button 
                    v-if="member.role !== 'owner'" 
                    class="action-btn danger small" 
                    @click="removeMember(project.id, member.user_id)"
                    :disabled="member.status === 'inactive'"
                  >
                    删除
                  </button>
                  <button 
                    v-if="member.role !== 'owner'" 
                    class="action-btn warning small" 
                    @click="toggleBanMember(project.id, member.user_id, member.status)"
                  >
                    {{ member.status === 'banned' ? '解封' : '拉黑' }}
                  </button>
                </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 邀请成员模态框 -->
    <div v-if="showInvite" class="modal-overlay" @click="closeInviteModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>邀请成员加入项目</h3>
          <button class="close-btn" @click="closeInviteModal">×</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>项目名称</label>
            <input type="text" :value="inviteProject?.name" readonly class="readonly-input">
          </div>
          
          <div class="form-group">
            <label>成员用户名</label>
            <input 
              type="text" 
              v-model="inviteForm.username" 
              placeholder="请输入要邀请的用户名"
              class="form-input"
            >
          </div>
          
          <div class="form-group">
            <label>邀请消息（可选）</label>
            <textarea 
              v-model="inviteForm.message" 
              placeholder="请输入邀请消息..."
              class="form-textarea"
              rows="3"
            ></textarea>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeInviteModal">取消</button>
          <button class="btn-confirm" @click="sendInvite" :disabled="!inviteForm.username.trim()">
            发送邀请
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Team',
  data() {
    return {
      loading: true,
      myProjects: [],
      expandedProjects: [],
      showInvite: false,
      inviteProject: null,
      inviteForm: {
        username: '',
        message: ''
      }
    }
  },
  
  async mounted() {
    await this.loadMyProjects()
  },
  
  methods: {
    async loadMyProjects() {
      try {
        this.loading = true
        
        const currentUser = localStorage.getItem('currentUser')
        if (!currentUser) {
          this.$router.push('/auth')
          return
        }
        
        const user = JSON.parse(currentUser)
        
        // 获取用户创建的项目
        const response = await fetch(`http://39.108.142.250:3000/api/team/my-projects/${user.id}`)
        const result = await response.json()
        
        if (result.success) {
          this.myProjects = result.data || []
        } else {
          console.error('获取项目列表失败:', result.error)
        }
      } catch (error) {
        console.error('加载项目列表失败:', error)
      } finally {
        this.loading = false
      }
    },
    
    async toggleProjectMembers(projectId) {
      const index = this.expandedProjects.indexOf(projectId)
      if (index > -1) {
        this.expandedProjects.splice(index, 1)
      } else {
        this.expandedProjects.push(projectId)
        // 加载项目成员
        await this.loadProjectMembers(projectId)
      }
    },
    
    async loadProjectMembers(projectId) {
      try {
        const response = await fetch(`http://39.108.142.250:3000/api/team/project-members/${projectId}`)
        const result = await response.json()
        
        if (result.success) {
          const project = this.myProjects.find(p => p.id === projectId)
          if (project) {
            project.members = result.data
          }
        }
      } catch (error) {
        console.error('加载项目成员失败:', error)
      }
    },
    
    async removeMember(projectId, memberId) {
      if (!confirm('确定要删除该成员吗？')) return
      
      try {
        const response = await fetch(`http://39.108.142.250:3000/api/team/remove-member`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            projectId,
            memberId
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          alert('成员删除成功')
          await this.loadProjectMembers(projectId)
        } else {
          alert('删除失败: ' + result.error)
        }
      } catch (error) {
        console.error('删除成员失败:', error)
        alert('删除成员失败')
      }
    },
    
    async toggleBanMember(projectId, memberId, currentStatus) {
      const action = currentStatus === 'banned' ? '解封' : '拉黑'
      if (!confirm(`确定要${action}该成员吗？`)) return
      
      try {
        const response = await fetch(`http://39.108.142.250:3000/api/team/toggle-ban-member`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            projectId,
            memberId,
            action: currentStatus === 'banned' ? 'unban' : 'ban'
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          alert(`成员${action}成功`)
          await this.loadProjectMembers(projectId)
        } else {
          alert(`${action}失败: ` + result.error)
        }
      } catch (error) {
        console.error(`${action}成员失败:`, error)
        alert(`${action}成员失败`)
      }
    },
    
    showInviteModal(project) {
      this.inviteProject = project
      this.inviteForm = {
        username: '',
        message: ''
      }
      this.showInvite = true
    },
    
    closeInviteModal() {
      this.showInvite = false
      this.inviteProject = null
      this.inviteForm = {
        username: '',
        message: ''
      }
    },
    
    async sendInvite() {
      if (!this.inviteForm.username.trim()) return
      
      try {
        const response = await fetch(`http://39.108.142.250:3000/api/team/invite-member`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            projectId: this.inviteProject.id,
            username: this.inviteForm.username,
            message: this.inviteForm.message
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          alert('邀请发送成功')
          this.closeInviteModal()
        } else {
          alert('邀请失败: ' + result.error)
        }
      } catch (error) {
        console.error('发送邀请失败:', error)
        alert('发送邀请失败')
      }
    },
    
    goToCreateProject() {
      this.$router.push('/project-create')
    },
    
    getProjectIcon(type) {
      const icons = {
        'vue': '🟢',
        'react': '🔵',
        'angular': '🔴',
        'html': '🟡',
        'node': '🟠',
        'python': '🐍',
        'java': '☕'
      }
      return icons[type] || '📁'
    },
    
    getProjectTypeName(type) {
      const types = {
        'vue': 'Vue.js',
        'react': 'React',
        'angular': 'Angular',
        'html': 'HTML',
        'node': 'Node.js',
        'python': 'Python',
        'java': 'Java'
      }
      return types[type] || type
    },
    
    getRoleText(role) {
      const roles = {
        'owner': '项目创建者',
        'admin': '管理员',
        'member': '普通成员'
      }
      return roles[role] || role
    },
    
    getStatusText(status) {
      const statuses = {
        'active': '正常',
        'banned': '已拉黑',
        'pending': '待确认'
      }
      return statuses[status] || status
    },
    
    formatDate(dateString) {
      const date = new Date(dateString)
      return date.toLocaleDateString('zh-CN')
    }
  }
}
</script>

<style scoped>
.team-container {
  padding: 20px;
  color: #333;
  max-width: 1200px;
  margin: 0 auto;
}

.team-header {
  margin-bottom: 30px;
}

.team-header h1 {
  font-size: 2rem;
  margin-bottom: 8px;
  color: #333;
}

.team-header p {
  color: #666;
  font-size: 1rem;
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

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 20px;
}

.empty-state h3 {
  color: #333;
  margin-bottom: 10px;
}

.empty-state p {
  color: #666;
  margin-bottom: 30px;
}

.create-project-btn {
  background: linear-gradient(135deg, #23a6d5, #23d5ab);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.create-project-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(35, 166, 213, 0.3);
}

.projects-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.project-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid #e1e5e9;
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.project-info {
  display: flex;
  align-items: flex-start;
  gap: 15px;
}

.project-icon {
  font-size: 2rem;
  margin-top: 5px;
}

.project-details {
  flex: 1;
}

.project-name {
  font-size: 1.3rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 5px;
}

.project-description {
  color: #666;
  margin-bottom: 10px;
  line-height: 1.5;
}

.project-meta {
  display: flex;
  gap: 15px;
  font-size: 0.9rem;
  color: #888;
}

.project-type {
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 4px;
}

.action-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-btn.primary {
  background: #23a6d5;
  color: white;
}

.action-btn.danger {
  background: #e74c3c;
  color: white;
}

.action-btn.warning {
  background: #f39c12;
  color: white;
}

.action-btn.small {
  padding: 6px 12px;
  font-size: 12px;
}

.action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.members-section {
  border-top: 1px solid #e1e5e9;
  padding-top: 20px;
}

.members-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.members-header h4 {
  color: #333;
  font-size: 1.1rem;
}

.invite-btn {
  background: #27ae60;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.invite-btn:hover {
  background: #229954;
  transform: translateY(-1px);
}

.no-members {
  text-align: center;
  padding: 30px;
  color: #666;
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.member-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.member-avatar {
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 50%;
  border: 2px solid #e1e5e9;
}

.member-details {
  flex: 1;
}

.member-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}

.member-role {
  font-size: 0.9rem;
  margin-bottom: 2px;
}

.member-role.owner {
  color: #e74c3c;
}

.member-role.admin {
  color: #f39c12;
}

.member-role.member {
  color: #23a6d5;
}

.member-status {
  font-size: 0.8rem;
}

.member-status.active {
  color: #27ae60;
}

.member-status.banned {
  color: #e74c3c;
}

.member-status.pending {
  color: #f39c12;
}

.member-actions {
  display: flex;
  gap: 8px;
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

.form-input,
.form-textarea,
.readonly-input {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e1e5e9;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s ease;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #23a6d5;
}

.readonly-input {
  background: #f8f9fa;
  color: #666;
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

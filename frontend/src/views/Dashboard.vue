<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <h1>仪表板</h1>
      <p>欢迎使用 WSLOP 平台</p>
    </div>
    
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>正在加载数据...</p>
    </div>
    
    <div v-else>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📁</div>
          <div class="stat-content">
            <div class="stat-number">{{ stats.projects }}</div>
            <div class="stat-label">项目总数</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">📄</div>
          <div class="stat-content">
            <div class="stat-number">{{ stats.files }}</div>
            <div class="stat-label">文件总数</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-content">
            <div class="stat-number">{{ stats.members }}</div>
            <div class="stat-label">团队成员</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">🎮</div>
          <div class="stat-content">
            <div class="stat-number">{{ stats.aiChats }}</div>
            <div class="stat-label">3D交互</div>
          </div>
        </div>
      </div>
      
      <div class="content-grid">
        <div class="recent-projects">
          <h3>最近项目</h3>
          <div v-if="recentProjects.length === 0" class="empty-state">
            <div class="empty-icon">📁</div>
            <p>暂无项目</p>
            <button class="create-project-btn" @click="createProject">创建第一个项目</button>
          </div>
          <div v-else class="project-list">
            <div v-for="project in recentProjects" :key="project.id" class="project-item" @click="goToProject(project.id)">
              <div class="project-icon">📁</div>
              <div class="project-info">
                <div class="project-name">{{ project.name }}</div>
                <div class="project-desc">{{ project.description }}</div>
              </div>
              <div class="project-date">{{ project.updatedAt }}</div>
            </div>
          </div>
        </div>
        
        <div class="quick-actions">
          <h3>快速操作</h3>
          <div class="action-buttons">
            <button class="action-btn" @click="createProject">➕ 创建项目</button>
            <button class="action-btn" @click="goToFiles">📁 文件管理</button>
            <button class="action-btn" @click="goToAI">🎮 3D助手</button>
            <button class="action-btn" @click="goToTeam">👥 团队协作</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Dashboard',
  data() {
    return {
      loading: true,
      stats: {
        projects: 0,
        files: 0,
        members: 0,
        aiChats: 0
      },
      recentProjects: []
    }
  },
  async mounted() {
    await this.loadDashboardData()
  },
  methods: {
    async loadDashboardData() {
      try {
        this.loading = true
        
        // 获取当前用户信息
        const currentUser = localStorage.getItem('currentUser')
        if (!currentUser) {
          console.error('用户未登录')
          this.$router.push('/auth')
          return
        }
        
        const user = JSON.parse(currentUser)
        
        // 调用API获取仪表盘数据
        const response = await fetch(`http://39.108.142.250:3000/api/auth/dashboard/${user.id}`)
        const result = await response.json()
        
        if (result.success) {
          this.stats = result.data.stats
          this.recentProjects = result.data.recentProjects
        } else {
          console.error('获取仪表盘数据失败:', result.error)
        }
      } catch (error) {
        console.error('加载仪表盘数据失败:', error)
      } finally {
        this.loading = false
      }
    },
    
    createProject() {
      this.$router.push('/project-create')
    },
    
    goToProject(projectId) {
      // 保存项目信息到localStorage
      const project = this.recentProjects.find(p => p.id === projectId)
      if (project) {
        localStorage.setItem('currentProject', JSON.stringify(project))
        this.$router.push(`/main-app/${projectId}`)
      }
    },
    
    goToFiles() {
      this.$router.push('/files')
    },
    
    goToAI() {
      this.$router.push('/ai-assistant')
    },
    
    goToTeam() {
      this.$router.push('/team')
    }
  }
}
</script>

<style scoped>
.dashboard {
  padding: 20px;
  color: #333;
}

.dashboard-header {
  margin-bottom: 30px;
}

.dashboard-header h1 {
  font-size: 2.5rem;
  margin: 0 0 10px 0;
  background: linear-gradient(45deg, #23a6d5, #23d5ab);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.dashboard-header p {
  font-size: 1.1rem;
  color: #666;
  margin: 0;
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 15px;
  padding: 25px;
  display: flex;
  align-items: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-icon {
  font-size: 3rem;
  margin-right: 20px;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: bold;
  color: #23a6d5;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 1rem;
  color: #666;
}

.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 30px;
}

.recent-projects, .quick-actions {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.recent-projects h3, .quick-actions h3 {
  margin: 0 0 20px 0;
  font-size: 1.3rem;
  color: #333;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-state p {
  color: #666;
  margin-bottom: 20px;
}

.create-project-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(45deg, #23a6d5, #23d5ab);
  color: white;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.create-project-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(35, 166, 213, 0.3);
}

.project-item {
  display: flex;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.project-item:hover {
  background-color: rgba(35, 166, 213, 0.05);
  border-radius: 8px;
  padding: 15px;
  margin: 0 -15px;
}

.project-item:last-child {
  border-bottom: none;
}

.project-icon {
  font-size: 1.5rem;
  margin-right: 15px;
}

.project-info {
  flex: 1;
}

.project-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 5px;
}

.project-desc {
  font-size: 0.9rem;
  color: #666;
}

.project-date {
  font-size: 0.8rem;
  color: #999;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.action-btn {
  padding: 15px 20px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(45deg, #23a6d5, #23d5ab);
  color: white;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(35, 166, 213, 0.3);
}

@media (max-width: 768px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

</style>

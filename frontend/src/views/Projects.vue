<template>
  <div class="projects">
    <div class="page-header">
      <h1>项目管理</h1>
      <div class="header-actions">
        <button class="refresh-btn" @click="refreshProjects" :disabled="loading">🔄 刷新</button>
        <button class="create-btn" @click="createProject">➕ 创建项目</button>
      </div>
    </div>
    
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>正在加载项目...</p>
    </div>
    
    <div v-else-if="error" class="error-container">
      <div class="error-icon">❌</div>
      <p>{{ error }}</p>
      <button class="retry-btn" @click="loadProjects">重试</button>
    </div>
    
    <div v-else-if="projects.length === 0" class="empty-state">
      <div class="empty-icon">📁</div>
      <h3>暂无项目</h3>
      <p>您还没有创建任何项目，点击上方按钮创建第一个项目吧！</p>
      <button class="create-project-btn" @click="createProject">创建第一个项目</button>
    </div>
    
    <div v-else>
      <!-- 项目类型切换按钮 -->
      <div class="project-type-filters">
        <button 
          v-for="type in projectTypes" 
          :key="type.type"
          class="type-filter-btn"
          :class="{ active: selectedType === type.type }"
          @click="selectProjectType(type.type)"
        >
          <span class="type-icon">{{ type.icon }}</span>
          <span class="type-name">{{ type.name }}</span>
          <span class="type-count">({{ getProjectCountByType(type.type) }})</span>
        </button>
      </div>

      <!-- 当前选择的项目类型 -->
      <div class="current-category">
        <div class="category-header">
          <div class="category-icon">{{ getCurrentTypeInfo().icon }}</div>
          <h2 class="category-title">{{ getCurrentTypeInfo().name }}</h2>
          <span class="category-count">({{ getCurrentTypeInfo().projects.length }})</span>
        </div>
        
        <!-- 分页信息 -->
        <div v-if="getCurrentTypeInfo().projects.length > 0" class="pagination-info">
          <span>共 {{ getCurrentTypeInfo().projects.length }} 个项目</span>
          <span v-if="totalPages > 1">第 {{ currentPage }} / {{ totalPages }} 页</span>
        </div>
    </div>
    
      <!-- 项目列表 -->
      <div v-if="getCurrentTypeInfo().projects.length > 0" class="projects-container">
    <div class="projects-grid">
          <div v-for="project in paginatedProjects" :key="project.id" class="project-card">
        <div class="project-header">
              <div class="project-icon">{{ project.icon }}</div>
              <div class="project-status" :class="project.status">{{ project.status === 'active' ? '进行中' : '已归档' }}</div>
        </div>
        <div class="project-content">
          <h3>{{ project.name }}</h3>
          <p>{{ project.description }}</p>
              <div class="project-tech">
                <span class="tech-label">技术栈:</span>
                <span class="tech-stack">{{ project.tech }}</span>
              </div>
          <div class="project-meta">
            <span>👥 {{ project.members }} 成员</span>
            <span>📄 {{ project.files }} 文件</span>
                <span>📅 {{ formatDate(project.updated_at) }}</span>
          </div>
        </div>
        <div class="project-actions">
              <button class="action-btn" @click="openProject(project)">打开</button>
              <button class="action-btn delete-btn" @click="deleteProject(project)">删除</button>
        </div>
          </div>
        </div>

        <!-- 分页控件 -->
        <div v-if="totalPages > 1" class="pagination-controls">
          <button 
            class="pagination-btn" 
            :disabled="currentPage === 1"
            @click="goToPage(currentPage - 1)"
          >
            ← 上一页
          </button>
          
          <div class="page-numbers">
            <button 
              v-for="page in visiblePages" 
              :key="page"
              class="page-number-btn"
              :class="{ active: page === currentPage }"
              @click="goToPage(page)"
            >
              {{ page }}
            </button>
          </div>
          
          <button 
            class="pagination-btn" 
            :disabled="currentPage === totalPages"
            @click="goToPage(currentPage + 1)"
          >
            下一页 →
          </button>
        </div>
      </div>
      
      <!-- 空状态 -->
      <div v-else class="empty-category">
        <div class="empty-icon">📁</div>
        <p>暂无{{ getCurrentTypeInfo().name }}项目</p>
        <button class="create-project-btn" @click="createProject">创建{{ getCurrentTypeInfo().name }}</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Projects',
  data() {
    return {
      projects: [],
      loading: true,
      error: null,
      selectedType: 'all', // 当前选择的项目类型
      currentPage: 1, // 当前页码
      pageSize: 6 // 每页显示的项目数量
    }
  },
  computed: {
    // 项目类型定义
    projectTypes() {
      return [
        {
          type: 'all',
          name: '全部项目',
          icon: '📁'
        },
        {
          type: 'html',
          name: 'HTML项目',
          icon: '🌐'
        },
        {
          type: 'vue',
          name: 'Vue项目',
          icon: '💚'
        },
        {
          type: 'android',
          name: 'Android项目',
          icon: '🤖'
        },
        {
          type: 'miniprogram',
          name: '小程序',
          icon: '📱'
        },
        {
          type: 'react',
          name: 'React项目',
          icon: '⚛️'
        }
      ]
    },

    // 当前类型的项目
    currentTypeProjects() {
      if (this.selectedType === 'all') {
        return this.projects
      }
      
      return this.projects.filter(project => {
        let projectType = project.type
        // 特殊映射：将现有的web类型项目映射到vue分类
        if (project.type === 'web') {
          projectType = 'vue'
        }
        return projectType === this.selectedType
      })
    },

    // 分页后的项目
    paginatedProjects() {
      const start = (this.currentPage - 1) * this.pageSize
      const end = start + this.pageSize
      return this.currentTypeProjects.slice(start, end)
    },

    // 总页数
    totalPages() {
      return Math.ceil(this.currentTypeProjects.length / this.pageSize)
    },

    // 可见的页码
    visiblePages() {
      const pages = []
      const total = this.totalPages
      const current = this.currentPage
      
      if (total <= 7) {
        // 如果总页数不超过7页，显示所有页码
        for (let i = 1; i <= total; i++) {
          pages.push(i)
        }
      } else {
        // 如果总页数超过7页，显示当前页附近的页码
        if (current <= 4) {
          // 当前页在前4页
          for (let i = 1; i <= 5; i++) {
            pages.push(i)
          }
          pages.push('...')
          pages.push(total)
        } else if (current >= total - 3) {
          // 当前页在后4页
          pages.push(1)
          pages.push('...')
          for (let i = total - 4; i <= total; i++) {
            pages.push(i)
          }
        } else {
          // 当前页在中间
          pages.push(1)
          pages.push('...')
          for (let i = current - 1; i <= current + 1; i++) {
            pages.push(i)
          }
          pages.push('...')
          pages.push(total)
        }
      }
      
      return pages
    },

    // 兼容旧的计算属性
    projectCategories() {
      const categories = [
        {
          type: 'html',
          name: 'HTML项目',
          icon: '🌐',
          projects: []
        },
        {
          type: 'vue',
          name: 'Vue项目',
          icon: '💚',
          projects: []
        },
        {
          type: 'android',
          name: 'Android项目',
          icon: '🤖',
          projects: []
        },
        {
          type: 'miniprogram',
          name: '小程序',
          icon: '📱',
          projects: []
        },
        {
          type: 'react',
          name: 'React项目',
          icon: '⚛️',
          projects: []
        }
      ]
      
      // 将项目按类型分类
      this.projects.forEach(project => {
        let categoryType = project.type
        
        // 特殊映射：将现有的web类型项目映射到vue分类
        if (project.type === 'web') {
          categoryType = 'vue'
        }
        
        const category = categories.find(cat => cat.type === categoryType)
        if (category) {
          category.projects.push(project)
        } else {
          // 如果类型不匹配，放入"其他"分类
          categories[categories.length - 1].projects.push(project)
        }
      })
      
      // 只显示有项目的分类
      return categories.filter(category => category.projects.length > 0)
    }
  },
  async mounted() {
    await this.loadProjects()
  },
  methods: {
    async loadProjects() {
      try {
        this.loading = true
        this.error = null
        
        // 获取当前用户信息
        const currentUser = localStorage.getItem('currentUser')
        if (!currentUser) {
          this.error = '用户未登录'
          this.$router.push('/auth')
          return
        }
        
        const user = JSON.parse(currentUser)
        
        // 调用仪表盘API获取完整数据（包含统计信息）
        const response = await fetch(`http://39.108.142.250:3000/api/auth/dashboard/${user.id}`)
        const result = await response.json()
        
        if (result.success) {
          // 获取用户项目列表
          const projectsResponse = await fetch(`http://39.108.142.250:3000/api/projects/user/${user.id}`)
          const projectsResult = await projectsResponse.json()
          
          if (projectsResult.success) {
            // 为每个项目获取详细的统计信息
            this.projects = await Promise.all(
              projectsResult.data.map(async (project) => {
                let fileCount = 0
                let memberCount = 0
                
                try {
                  // 获取项目文件数量
                  const fileResponse = await fetch(`http://39.108.142.250:3000/api/projects/${project.id}/files/count`)
                  const fileResult = await fileResponse.json()
                  if (fileResult.success) {
                    fileCount = fileResult.data
                  }
                  
                  // 获取项目成员数量
                  const memberResponse = await fetch(`http://39.108.142.250:3000/api/projects/${project.id}/members/count`)
                  const memberResult = await memberResponse.json()
                  console.log(`项目 ${project.name} 成员数量API响应:`, memberResult)
                  if (memberResult.success) {
                    memberCount = memberResult.data
                  }
                  
                  // 调试信息：检查项目原始数据
                  console.log(`项目 ${project.name} 原始数据:`, {
                    id: project.id,
                    name: project.name,
                    members: project.members,
                    membersLength: project.members ? project.members.length : 0
                  })
                } catch (error) {
                  console.warn(`获取项目 ${project.name} 统计信息失败:`, error)
                  // 使用项目数据中的成员信息作为备选
                  memberCount = project.members ? project.members.length : 0
                  console.log(`使用备选成员数: ${memberCount}`)
                }
                
                return {
                  id: project.id,
                  name: project.name,
                  description: project.description || '暂无描述',
                  status: project.status,
                  type: project.type,
                  members: memberCount,
                  files: fileCount,
                  tech: this.getTechStackByType(project.type),
                  icon: this.getIconByType(project.type),
                  created_at: project.created_at,
                  updated_at: project.updated_at
                }
              })
            )
          } else {
            this.error = projectsResult.error || '获取项目失败'
          }
        } else {
          this.error = result.error || '获取数据失败'
        }
      } catch (error) {
        console.error('加载项目失败:', error)
        this.error = '网络错误，请稍后重试'
      } finally {
        this.loading = false
      }
    },
    
    getTechStackByType(type) {
      const techStacks = {
        'html': 'HTML5, CSS3, JavaScript, Bootstrap',
        'vue': 'Vue3, Vue Router, Pinia, Element Plus',
        'android': 'Java, Kotlin, Android SDK, Gradle',
        'miniprogram': '微信小程序 - WXML, WXSS, JavaScript',
        'react': 'React, Redux, JSX, Webpack',
        'web': 'Vue3, Node.js, MySQL, Three.js, DeepSeek AI',
        'mobile': 'Flutter, Dart, Firebase',
        'desktop': 'Electron, Node.js, Vue3',
        'api': 'Node.js, Express, MySQL, REST API',
        'other': '自定义技术栈'
      }
      return techStacks[type] || '未知技术栈'
    },
    
    getIconByType(type) {
      const icons = {
        'html': '🌐',
        'vue': '💚',
        'android': '🤖',
        'miniprogram': '📱',
        'react': '⚛️',
        'web': '🌐',
        'mobile': '📱',
        'desktop': '💻',
        'api': '🔌',
        'other': '📦'
      }
      return icons[type] || '📁'
    },
    
    async createProject() {
      this.$router.push('/project-create')
    },
    
    openProject(project) {
      // 保存项目信息到localStorage
      localStorage.setItem('currentProject', JSON.stringify(project))
      this.$router.push(`/main-app/${project.id}`)
    },
    
    async refreshProjects() {
      await this.loadProjects()
    },
    
    async deleteProject(project) {
      if (!confirm(`确定要删除项目 "${project.name}" 吗？此操作不可撤销！`)) {
        return
      }
      
      try {
        const response = await fetch(`http://39.108.142.250:3000/api/projects/${project.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          }
        })
        
        const result = await response.json()
        
        if (result.success) {
          alert('项目删除成功！')
          await this.loadProjects() // 重新加载项目列表
        } else {
          alert(`删除失败: ${result.error}`)
        }
      } catch (error) {
        console.error('删除项目失败:', error)
        alert('删除失败，请稍后重试')
      }
    },
    
    formatDate(dateString) {
      if (!dateString) return '未知'
      const date = new Date(dateString)
      const now = new Date()
      const diffTime = Math.abs(now - date)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 1) {
        return '昨天'
      } else if (diffDays < 7) {
        return `${diffDays}天前`
      } else if (diffDays < 30) {
        return `${Math.ceil(diffDays / 7)}周前`
      } else {
        return date.toLocaleDateString('zh-CN')
      }
    },

    // 选择项目类型
    selectProjectType(type) {
      this.selectedType = type
      this.currentPage = 1 // 重置到第一页
    },

    // 获取指定类型的项目数量
    getProjectCountByType(type) {
      if (type === 'all') {
        return this.projects.length
      }
      
      return this.projects.filter(project => {
        let projectType = project.type
        if (project.type === 'web') {
          projectType = 'vue'
        }
        return projectType === type
      }).length
    },

    // 获取当前类型信息
    getCurrentTypeInfo() {
      const typeInfo = this.projectTypes.find(type => type.type === this.selectedType)
      return {
        ...typeInfo,
        projects: this.currentTypeProjects
      }
    },

    // 跳转到指定页面
    goToPage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page
        // 滚动到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }
}
</script>

<style scoped>
.projects {
  padding: 20px;
  color: #333;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.header-actions {
  display: flex;
  gap: 15px;
  align-items: center;
}

.refresh-btn {
  padding: 8px 16px;
  border: 1px solid #23a6d5;
  border-radius: 8px;
  background: transparent;
  color: #23a6d5;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: #23a6d5;
  color: white;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-header h1 {
  font-size: 2.5rem;
  margin: 0;
  background: linear-gradient(45deg, #23a6d5, #23d5ab);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.create-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(45deg, #23a6d5, #23d5ab);
  color: white;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.create-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(35, 166, 213, 0.3);
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

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 20px;
}

.error-container p {
  color: #e74c3c;
  font-size: 1.1rem;
  margin-bottom: 20px;
}

.retry-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: #e74c3c;
  color: white;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.retry-btn:hover {
  background: #c0392b;
  transform: translateY(-2px);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 1.5rem;
}

.empty-state p {
  color: #666;
  margin-bottom: 20px;
  font-size: 1rem;
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

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.project-card {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.project-card:hover {
  transform: translateY(-5px);
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.project-icon {
  font-size: 2rem;
}

.project-status {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

.project-status.active {
  background: #e8f5e8;
  color: #2e7d32;
}

.project-status.archived {
  background: #f5f5f5;
  color: #666;
}

.project-content h3 {
  margin: 0 0 10px 0;
  font-size: 1.3rem;
  color: #333;
}

.project-content p {
  margin: 0 0 15px 0;
  color: #666;
  line-height: 1.5;
}

.project-tech {
  margin: 10px 0 15px 0;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #23a6d5;
}

.tech-label {
  font-weight: 600;
  color: #23a6d5;
  font-size: 0.9rem;
}

.tech-stack {
  color: #666;
  font-size: 0.85rem;
  margin-left: 8px;
}

.project-meta {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
}

.project-meta span {
  font-size: 0.9rem;
  color: #666;
}

.project-actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  flex: 1;
  padding: 8px 16px;
  border: 1px solid #23a6d5;
  border-radius: 8px;
  background: transparent;
  color: #23a6d5;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-btn:hover {
  background: #23a6d5;
  color: white;
}

.delete-btn {
  border-color: #e74c3c !important;
  color: #e74c3c !important;
}

.delete-btn:hover {
  background: #e74c3c !important;
  color: white !important;
}

/* 项目分类样式 */
.project-categories {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.category-section {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.category-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #f0f0f0;
}

.category-icon {
  font-size: 2rem;
  margin-right: 15px;
}

.category-title {
  font-size: 1.5rem;
  margin: 0;
  color: #333;
  background: linear-gradient(45deg, #23a6d5, #23d5ab);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.category-count {
  margin-left: auto;
  padding: 4px 12px;
  background: #f0f0f0;
  border-radius: 20px;
  font-size: 0.9rem;
  color: #666;
  font-weight: 600;
}

.empty-category {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: #999;
}

.empty-category .empty-icon {
  font-size: 3rem;
  margin-bottom: 15px;
  opacity: 0.5;
}

.empty-category p {
  margin: 0;
  font-size: 1rem;
}

/* 项目类型切换按钮样式 */
.project-type-filters {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 15px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
  flex-wrap: wrap;
}

.type-filter-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: 2px solid #e0e0e0;
  border-radius: 25px;
  background: white;
  color: #666;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  min-width: fit-content;
}

.type-filter-btn:hover {
  border-color: #23a6d5;
  color: #23a6d5;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(35, 166, 213, 0.2);
}

.type-filter-btn.active {
  border-color: #23a6d5;
  background: linear-gradient(45deg, #23a6d5, #23d5ab);
  color: white;
  box-shadow: 0 4px 15px rgba(35, 166, 213, 0.3);
}

.type-icon {
  font-size: 1.2rem;
}

.type-name {
  font-weight: 600;
}

.type-count {
  font-size: 0.8rem;
  opacity: 0.8;
}

/* 当前分类样式 */
.current-category {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.pagination-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #f0f0f0;
  font-size: 0.9rem;
  color: #666;
}

/* 项目容器样式 */
.projects-container {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

/* 分页控件样式 */
.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}

.pagination-btn {
  padding: 8px 16px;
  border: 1px solid #23a6d5;
  border-radius: 8px;
  background: transparent;
  color: #23a6d5;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: #23a6d5;
  color: white;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 5px;
  align-items: center;
}

.page-number-btn {
  width: 40px;
  height: 40px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  color: #666;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-number-btn:hover {
  border-color: #23a6d5;
  color: #23a6d5;
}

.page-number-btn.active {
  border-color: #23a6d5;
  background: #23a6d5;
  color: white;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .project-type-filters {
    padding: 15px;
    gap: 8px;
  }
  
  .type-filter-btn {
    padding: 10px 16px;
    font-size: 0.8rem;
  }
  
  .projects-grid {
    grid-template-columns: 1fr;
  }
  
  .pagination-controls {
    flex-direction: column;
    gap: 15px;
  }
  
  .page-numbers {
    justify-content: center;
  }
  
  .pagination-info {
    flex-direction: column;
    gap: 5px;
    text-align: center;
  }
}
</style>

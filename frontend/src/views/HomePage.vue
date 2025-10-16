<template>
  <div class="home-container">
    <!-- 动态渐变背景 -->
    <div class="gradient-bg">
      <div class="logo-container">
        <img src="/logo.png" alt="WSLOP Logo" class="logo-image">
      </div>
    </div>

    <!-- 顶部导航栏 -->
    <header class="top-navbar">
      <div class="nav-left">
        <img src="/logo.png" alt="WSLOP Logo" class="logo-mini-image">
      </div>
      
      <div class="nav-center">
        <div class="search-container">
          <input type="text" placeholder="搜索项目、文件、AI对话..." class="search-input" v-model="searchQuery" @keyup.enter="performSearch" @input="onSearchInput">
          <button class="search-btn" @click="performSearch">🔍</button>
          
          <!-- 搜索结果下拉框 -->
          <div v-if="showSearchResults" class="search-results">
            <div v-if="searchResults.length === 0 && searchQuery" class="no-results">
              没有找到相关结果
            </div>
            <div v-for="result in searchResults" :key="result.id" class="search-result-item" @click="navigateToResult(result)">
              <div class="result-icon">{{ result.icon }}</div>
              <div class="result-content">
                <div class="result-title">{{ result.title }}</div>
                <div class="result-description">{{ result.description }}</div>
                <div class="result-type">{{ result.type }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="nav-right">
        <div class="user-info" @click="toggleUserMenu">
          <div class="user-avatar">{{ currentUser?.avatar || '👤' }}</div>
          <div class="user-details">
            <div class="username">{{ currentUser?.username || '未登录' }}</div>
            <div class="user-status">{{ currentUser?.role || '游客' }}</div>
          </div>
          <div class="user-dropdown" v-show="showUserMenu">
            <div class="dropdown-item" @click="goToProfile">个人资料</div>
            <div class="dropdown-item" @click="goToSettings">设置</div>
            <div class="dropdown-item" @click="logout">退出登录</div>
          </div>
        </div>
      </div>
    </header>

    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
      <nav class="sidebar-nav">
        <div v-for="item in menuItems" :key="item.path" class="nav-item" 
             :class="{ 'active': currentRoute === item.path }" @click="navigateTo(item.path)">
          <div class="nav-icon">{{ item.icon }}</div>
          <div class="nav-text" v-show="!sidebarCollapsed">{{ item.name }}</div>
        </div>
      </nav>
    </aside>

    <!-- 主内容区域 -->
    <main class="main-content" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
      <router-view />
    </main>
  </div>
</template>

<script>
export default {
  name: 'HomePage',
  data() {
    return {
      searchQuery: '',
      searchResults: [],
      showSearchResults: false,
      searchTimeout: null,
      sidebarCollapsed: false,
      currentRoute: '/',
      showUserMenu: false,
      currentUser: null,
      menuItems: [
          { name: '仪表板', path: '/', icon: '📊' },
        { name: '项目管理', path: '/projects', icon: '📁' },
        { name: 'AI对话', path: '/files', icon: '🤖' },
        { name: '3D模型', path: '/ai-assistant', icon: '🎮' },
        { name: '团队管理', path: '/team', icon: '👥' },
        { name: '好友聊天', path: '/friends', icon: '💬' },
        { name: '设置', path: '/settings', icon: '⚙️' }
      ]
    }
  },
  watch: {
    $route(to) {
      this.currentRoute = to.path
    }
  },
  mounted() {
    this.currentRoute = this.$route.path
    this.loadCurrentUser()
    
    // 添加点击外部隐藏搜索结果的事件监听
    document.addEventListener('click', this.handleDocumentClick)
  },
  
  beforeUnmount() {
    // 清理事件监听器
    document.removeEventListener('click', this.handleDocumentClick)
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout)
    }
  },
  methods: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },
    navigateTo(path) {
      this.$router.push(path)
    },
    loadCurrentUser() {
      const userStr = localStorage.getItem('currentUser')
      if (userStr) {
        try {
          this.currentUser = JSON.parse(userStr)
        } catch (error) {
          console.error('解析用户信息失败:', error)
          this.logout()
        }
      }
    },
    toggleUserMenu() {
      this.showUserMenu = !this.showUserMenu
    },
    goToProfile() {
      this.showUserMenu = false
      this.$router.push('/settings')
    },
    goToSettings() {
      this.showUserMenu = false
      this.$router.push('/settings')
    },
    logout() {
      localStorage.removeItem('currentUser')
      localStorage.removeItem('rememberLogin')
      this.currentUser = null
      this.showUserMenu = false
      this.$router.push('/auth')
    },
    
    // 搜索相关方法
    onSearchInput() {
      // 清除之前的定时器
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout)
      }
      
      // 如果搜索框为空，隐藏结果
      if (!this.searchQuery.trim()) {
        this.showSearchResults = false
        this.searchResults = []
        return
      }
      
      // 延迟搜索，避免频繁请求
      this.searchTimeout = setTimeout(() => {
        this.performSearch()
      }, 300)
    },
    
    async performSearch() {
      if (!this.searchQuery.trim()) {
        this.showSearchResults = false
        this.searchResults = []
        return
      }
      
      try {
        this.showSearchResults = true
        
        // 获取当前用户信息
        const currentUser = localStorage.getItem('currentUser')
        if (!currentUser) {
          console.error('用户未登录')
          return
        }
        
        const user = JSON.parse(currentUser)
        
        // 调用搜索API
        const response = await fetch(`http://39.108.142.250:3000/api/search?query=${encodeURIComponent(this.searchQuery)}&userId=${user.id}`)
        const result = await response.json()
        
        if (result.success) {
          this.searchResults = result.data || []
        } else {
          console.error('搜索失败:', result.error)
          this.searchResults = []
        }
      } catch (error) {
        console.error('搜索请求失败:', error)
        this.searchResults = []
      }
    },
    
    navigateToResult(result) {
      this.showSearchResults = false
      this.searchQuery = ''
      
      // 根据结果类型导航到相应页面
      switch (result.type) {
        case 'project':
          localStorage.setItem('currentProject', JSON.stringify(result.data))
          this.$router.push(`/main-app/${result.id}`)
          break
        case 'file':
          localStorage.setItem('currentProject', JSON.stringify(result.projectData))
          this.$router.push(`/main-app/${result.projectId}`)
          break
        case 'ai_chat':
          this.$router.push('/files')
          break
        case 'menu':
          this.$router.push(result.path)
          break
        default:
          console.log('未知的结果类型:', result.type)
      }
    },
    
    // 点击其他地方时隐藏搜索结果
    hideSearchResults() {
      this.showSearchResults = false
    },
    
    // 处理文档点击事件
    handleDocumentClick(event) {
      const searchContainer = this.$el.querySelector('.search-container')
      if (searchContainer && !searchContainer.contains(event.target)) {
        this.hideSearchResults()
      }
    }
  }
}
</script>

<style scoped>
.home-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.gradient-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
  z-index: -1;
}

@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.logo-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 0;
}

.logo-image {
  max-width: 300px;
  max-height: 300px;
  width: auto;
  height: auto;
  opacity: 0.8;
  filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.3));
  animation: logoFloat 6s ease-in-out infinite;
}

@keyframes logoFloat {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
}

.top-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.nav-left .logo-mini-image {
  height: 40px;
  width: auto;
  max-width: 120px;
}

.nav-center {
  flex: 1;
  display: flex;
  justify-content: center;
  max-width: 500px;
  margin: 0 20px;
}

.search-container {
  position: relative;
  width: 100%;
  max-width: 400px;
}

.search-input {
  width: 100%;
  padding: 10px 45px 10px 15px;
  border: 2px solid #e1e5e9;
  border-radius: 25px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.9);
  transition: all 0.3s ease;
}

.search-input:focus {
  outline: none;
  border-color: #23a6d5;
  box-shadow: 0 0 10px rgba(35, 166, 213, 0.3);
}

.search-btn {
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
  margin-top: 5px;
}

.search-result-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
  transition: background-color 0.3s ease;
}

.search-result-item:hover {
  background: #f8f9fa;
}

.search-result-item:last-child {
  border-bottom: none;
}

.result-icon {
  font-size: 20px;
  margin-right: 12px;
  width: 24px;
  text-align: center;
}

.result-content {
  flex: 1;
}

.result-title {
  font-weight: 600;
  color: #333;
  font-size: 14px;
  margin-bottom: 2px;
}

.result-description {
  color: #666;
  font-size: 12px;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-type {
  color: #23a6d5;
  font-size: 11px;
  font-weight: 500;
}

.no-results {
  padding: 20px;
  text-align: center;
  color: #666;
  font-size: 14px;
}

.user-info {
  position: relative;
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 25px;
  background: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.3s ease;
}

.user-info:hover {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.user-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 8px 0;
  min-width: 150px;
  z-index: 1000;
  margin-top: 5px;
}

.dropdown-item {
  padding: 8px 16px;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.dropdown-item:hover {
  background: #f5f5f5;
}

.user-avatar {
  font-size: 24px;
  margin-right: 10px;
}

.user-details {
  display: flex;
  flex-direction: column;
}

.username {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.user-status {
  font-size: 12px;
  color: #23a6d5;
}

.sidebar {
  position: fixed;
  left: 0;
  top: 60px;
  width: 250px;
  height: calc(100vh - 60px);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-right: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
  z-index: 999;
}

.sidebar-collapsed {
  width: 60px;
}

.sidebar-nav {
  padding: 20px 0;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  margin: 4px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #666;
}

.nav-item:hover {
  background: rgba(35, 166, 213, 0.1);
  color: #23a6d5;
  transform: translateX(5px);
}

.nav-item.active {
  background: linear-gradient(45deg, #23a6d5, #23d5ab);
  color: white;
  box-shadow: 0 4px 15px rgba(35, 166, 213, 0.3);
}

.nav-icon {
  font-size: 20px;
  margin-right: 15px;
  min-width: 20px;
}

.nav-text {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.main-content {
  margin-left: 250px;
  margin-top: 60px;
  padding: 20px;
  min-height: calc(100vh - 60px);
  transition: margin-left 0.3s ease;
}

.main-content.sidebar-collapsed {
  margin-left: 60px;
}
</style>

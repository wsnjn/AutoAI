import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../views/HomePage.vue'
import Dashboard from '../views/Dashboard.vue'
import Projects from '../views/Projects.vue'
import Files from '../views/Files.vue'
import AIAssistant from '../views/AIAssistant.vue'
import Team from '../views/Team.vue'
import Friends from '../views/Friends.vue'
import Settings from '../views/Settings.vue'
import ProjectCreate from '../views/FolderSelect.vue'
import MainApp from '../views/MainApp.vue'
import Auth from '../views/Auth.vue'
 
const routes = [
  {
    path: '/',
    component: HomePage,
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: Dashboard
      },
      {
        path: 'projects',
        name: 'Projects',
        component: Projects
      },
      {
        path: 'files',
        name: 'Files',
        component: Files
      },
      {
        path: 'ai-assistant',
        name: 'AIAssistant',
        component: AIAssistant
      },
      {
        path: 'team',
        name: 'Team',
        component: Team
      },
      {
        path: 'friends',
        name: 'Friends',
        component: Friends
      },
      {
        path: 'settings',
        name: 'Settings',
        component: Settings
      }
    ]
  },
  {
    path: '/auth',
    name: 'Auth',
    component: Auth
  },
  {
    path: '/project-create',
    name: 'ProjectCreate',
    component: ProjectCreate
  },
  {
    path: '/main-app/:projectId',
    name: 'MainApp',
    component: MainApp,
    meta: { requiresProject: true }
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  // 检查是否需要登�?
  const currentUser = localStorage.getItem('currentUser')
  const isAuthPage = to.path === '/auth'
  
  // 如果访问登录页面且已登录，跳转到首页
  if (isAuthPage && currentUser) {
    next('/')
    return
  }
  
  // 如果访问需要登录的页面但未登录，跳转到登录�?
  if (!currentUser && to.path !== '/auth') {
    next('/auth')
    return
  }
  
  // 检查项目要�?
  if (to.meta.requiresProject) {
    const currentProject = localStorage.getItem('currentProject')
    if (!currentProject) {
      next('/project-create')
      return
    }
  }
  
  next()
})

export default router

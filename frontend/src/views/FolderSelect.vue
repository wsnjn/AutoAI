<template>
  <div class="project-create-container">
    <div class="project-create-card">
      <div class="header">
        <h1>欢迎使用 AutoAI</h1>
        <p>创建新项目或加入现有项目</p>
      </div>
      
      <!-- 创建新项目 -->
      <div class="create-project-section">
        <h3>🚀 创建新项目</h3>
        <div class="input-group">
          <label for="projectName">项目名称:</label>
          <input 
            id="projectName"
            type="text" 
            v-model="projectName" 
            placeholder="请输入项目名称"
            class="project-input"
            @input="onProjectNameInput"
          />
        </div>
        
        <div class="input-group">
          <label for="projectDescription">项目描述 (可选):</label>
          <textarea 
            id="projectDescription"
            v-model="projectDescription" 
            placeholder="请描述您的项目"
            class="project-textarea"
            rows="3"
          ></textarea>
        </div>
        
        <div class="project-type-section">
          <label>项目类型:</label>
          <div class="type-options">
            <label class="type-option">
              <input type="radio" v-model="projectType" value="html" />
              <span class="type-icon">🌐</span>
              <span>HTML项目</span>
            </label>
            <label class="type-option">
              <input type="radio" v-model="projectType" value="vue" />
              <span class="type-icon">💚</span>
              <span>Vue项目</span>
            </label>
            <label class="type-option">
              <input type="radio" v-model="projectType" value="android" />
              <span class="type-icon">🤖</span>
              <span>Android项目</span>
            </label>
            <label class="type-option">
              <input type="radio" v-model="projectType" value="miniprogram" />
              <span class="type-icon">📱</span>
              <span>小程序</span>
            </label>
            <label class="type-option">
              <input type="radio" v-model="projectType" value="react" />
              <span class="type-icon">⚛️</span>
              <span>React项目</span>
            </label>
          </div>
        </div>
        
        <button @click="createProject" class="create-btn" :disabled="!isProjectNameValid || isProcessing">
          {{ isProcessing ? '创建中...' : '创建项目' }}
        </button>
      </div>
      
      <!-- 分割线 -->
      <div class="divider">
        <span>或</span>
      </div>
      
      <!-- 加入现有项目 -->
      <div class="join-project-section">
        <h3>👥 加入现有项目</h3>
        <div class="input-group">
          <label for="projectId">项目ID:</label>
          <input 
            id="projectId"
            type="text" 
            v-model="projectId" 
            placeholder="请输入项目ID"
            class="project-input"
            @input="onProjectIdInput"
          />
        </div>
        
        <button @click="joinProject" class="join-btn" :disabled="!isProjectIdValid || isProcessing">
          {{ isProcessing ? '加入中...' : '加入项目' }}
        </button>
      </div>
      
      <!-- 项目预览 -->
      <div v-if="projectPreview" class="project-preview">
        <div class="preview-header">
          <h4>项目预览</h4>
        </div>
        <div class="preview-content">
          <div class="preview-item">
            <span class="label">项目名称:</span>
            <span class="value">{{ projectPreview.name }}</span>
          </div>
          <div class="preview-item">
            <span class="label">项目ID:</span>
            <span class="value project-id">{{ projectPreview.id }}</span>
          </div>
          <div class="preview-item">
            <span class="label">项目类型:</span>
            <span class="value">{{ getProjectTypeName(projectPreview.type) }}</span>
          </div>
          <div v-if="projectPreview.description" class="preview-item">
            <span class="label">项目描述:</span>
            <span class="value">{{ projectPreview.description }}</span>
          </div>
          <div class="preview-item">
            <span class="label">创建时间:</span>
            <span class="value">{{ projectPreview.createdAt }}</span>
          </div>
        </div>
      </div>
      
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
      
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
        <div class="success-actions">
          <button @click="goToMainApp" class="action-btn primary">进入项目</button>
          <button @click="createAnotherProject" class="action-btn secondary">创建新项目</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ProjectCreate',
  data() {
    return {
      currentUser: null,
      projectName: '',
      projectDescription: '',
      projectType: 'vue',
      projectId: '',
      errorMessage: '',
      successMessage: '',
      isProcessing: false,
      isProjectNameValid: false,
      isProjectIdValid: false,
      projectPreview: null
    }
  },
  mounted() {
    // 检查用户登录状态
    const currentUser = localStorage.getItem('currentUser')
    if (!currentUser) {
      console.error('❌ 用户未登录，跳转到登录页面')
      this.$router.push('/auth')
      return
    }
    
    try {
      this.currentUser = JSON.parse(currentUser)
      console.log('✅ 当前登录用户:', this.currentUser)
    } catch (error) {
      console.error('❌ 解析用户信息失败:', error)
      this.$router.push('/auth')
      return
    }
    
    // 检查是否已经加入过项目
    const savedProject = localStorage.getItem('currentProject')
    if (savedProject) {
      try {
        const project = JSON.parse(savedProject)
        this.successMessage = `已加入项目 ${project.name} (ID: ${project.id})`
      } catch (error) {
        console.error('解析保存的项目信息失败:', error)
      }
    }
  },
  methods: {
    onProjectNameInput() {
      console.log('\n🔍 ===== 项目名称输入分析 =====')
      console.log('📝 输入的项目名称:', this.projectName)
      
      // 验证项目名称 - 必须是英文，只能包含字母、数字、下划线，且必须以字母开头
      const englishNameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/
      const isValidName = this.projectName.length >= 2 && 
                          this.projectName.length <= 50 &&
                          englishNameRegex.test(this.projectName) &&
                          !this.projectName.includes('..')
      
      this.isProjectNameValid = isValidName
      
      console.log('📝 项目名称长度:', this.projectName.length)
      console.log('📝 是否包含特殊字符:', /[<>:"|?*\\/]/.test(this.projectName))
      console.log('✅ 项目名称验证结果:', this.isProjectNameValid ? '通过' : '失败')
      
      if (this.isProjectNameValid) {
        console.log('✅ 项目名称有效，可以创建项目')
      } else {
        console.log('⚠️ 项目名称无效，请检查格式')
      }
    },
    
    onProjectIdInput() {
      console.log('\n🔍 ===== 项目ID输入分析 =====')
      console.log('🆔 输入的项目ID:', this.projectId)
      
      // 验证项目ID格式 (假设8位数字和字母的组合)
      const isValidId = this.projectId.length === 8 && 
                       /^[A-Za-z0-9]{8}$/.test(this.projectId)
      
      this.isProjectIdValid = isValidId
      
      console.log('🆔 项目ID长度:', this.projectId.length)
      console.log('🆔 项目ID格式:', /^[A-Za-z0-9]{8}$/.test(this.projectId))
      console.log('✅ 项目ID验证结果:', this.isProjectIdValid ? '通过' : '失败')
      
      if (this.isProjectIdValid) {
        console.log('✅ 项目ID格式正确，可以尝试加入项目')
      } else {
        console.log('⚠️ 项目ID格式错误，请检查')
      }
    },
    
    getProjectTypeName(type) {
      const typeNames = {
        'html': 'HTML项目',
        'vue': 'Vue项目',
        'android': 'Android项目',
        'miniprogram': '小程序',
        'react': 'React项目',
        'web': 'Web应用',
        'mobile': '移动应用',
        'desktop': '桌面应用',
        'api': 'API服务',
        'other': '其他'
      }
      return typeNames[type] || '未知类型'
    },
    
    generateProjectId() {
      // 生成8位随机ID
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let result = ''
      for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return result
    },
    
    async createProject() {
      if (!this.isProjectNameValid) {
        this.errorMessage = '请输入有效的项目名称'
        return
      }
      
      this.isProcessing = true
      this.errorMessage = ''
      this.successMessage = ''
      
      try {
        console.log('\n🚀 ===== 开始创建新项目 =====')
        console.log('📝 项目名称:', this.projectName)
        console.log('📝 项目描述:', this.projectDescription)
        console.log('📝 项目类型:', this.projectType)
        
                 const projectData = {
           name: this.projectName,
           description: this.projectDescription,
           type: this.projectType,
           createdAt: new Date().toLocaleString(),
           createdBy: this.currentUser.username,
           createdById: this.currentUser.id,
           members: [this.currentUser.username],
           memberIds: [this.currentUser.id],
           status: 'active'
         }
        
        console.log('📊 项目数据:', projectData)
        
        const response = await fetch('http://39.108.142.250:3000/api/projects/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(projectData)
        })
        
        const result = await response.json()
        
        if (result.success) {
          console.log('\n✅ ===== 项目创建成功 =====')
          console.log('🆔 项目ID:', result.data?.id)
          console.log('📊 创建结果:', result.data)
          
                     this.successMessage = `项目 "${this.projectName}" 创建成功！项目ID: ${result.data?.id}`
           
           // 保存项目信息到本地存储（使用后端返回的完整项目信息）
           localStorage.setItem('currentProject', JSON.stringify(result.data))
          localStorage.setItem('projectStructure', JSON.stringify(result.data?.structure || {}))
          localStorage.setItem('serverResponse', JSON.stringify(result))
          
          console.log('💾 项目信息已保存到本地存储')
          console.log('✅ 项目创建完成，等待用户操作')
        } else {
          console.error('\n❌ ===== 项目创建失败 =====')
          console.error('❌ 错误信息:', result.error)
          this.errorMessage = `创建失败: ${result.error}`
        }
      } catch (error) {
        console.error('\n❌ ===== 网络请求失败 =====')
        console.error('🌐 请求URL:', 'http://39.108.142.250:3000/api/projects/create')
        console.error('❌ 错误类型:', error.name)
        console.error('❌ 错误消息:', error.message)
        this.errorMessage = `网络错误: ${error.message}`
      } finally {
        this.isProcessing = false
        console.log('🏁 ===== 项目创建处理完成 =====\n')
      }
    },
    
    goToMainApp() {
      this.$router.push('/main-app')
    },
    
    createAnotherProject() {
      // 重置表单
      this.projectName = ''
      this.projectDescription = ''
      this.projectType = 'vue'
      this.projectId = ''
      this.errorMessage = ''
      this.successMessage = ''
      this.isProcessing = false
      this.isProjectNameValid = false
      this.isProjectIdValid = false
      this.projectPreview = null
    },
    
    async joinProject() {
      if (!this.isProjectIdValid) {
        this.errorMessage = '请输入有效的项目ID'
        return
      }
      
      this.isProcessing = true
      this.errorMessage = ''
      this.successMessage = ''
      
      try {
        console.log('\n🚀 ===== 开始加入项目 =====')
        console.log('🆔 项目ID:', this.projectId)
        
        const response = await fetch(`http://39.108.142.250:3000/api/projects/join/${this.projectId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: this.currentUser.id,
            username: this.currentUser.username
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          console.log('\n✅ ===== 成功加入项目 =====')
          console.log('📊 项目信息:', result.data)
          
          this.successMessage = `成功加入项目: ${result.data?.name}`
          
          // 保存项目信息到本地存储
          localStorage.setItem('currentProject', JSON.stringify(result.data))
          localStorage.setItem('projectStructure', JSON.stringify(result.data?.structure || {}))
          localStorage.setItem('serverResponse', JSON.stringify(result))
          
          console.log('💾 项目信息已保存到本地存储')
          console.log('✅ 项目加入完成，等待用户操作')
        } else {
          console.error('\n❌ ===== 加入项目失败 =====')
          console.error('❌ 错误信息:', result.error)
          this.errorMessage = `加入失败: ${result.error}`
        }
      } catch (error) {
        console.error('\n❌ ===== 网络请求失败 =====')
        console.error('🌐 请求URL:', `http://39.108.142.250:3000/api/projects/join/${this.projectId}`)
        console.error('❌ 错误类型:', error.name)
        console.error('❌ 错误消息:', error.message)
        this.errorMessage = `网络错误: ${error.message}`
      } finally {
        this.isProcessing = false
        console.log('🏁 ===== 加入项目处理完成 =====\n')
      }
    }
  }
}
</script>

<style scoped>
.project-create-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.project-create-card {
  background: white;
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 800px;
  box-sizing: border-box;
}

.header {
  text-align: center;
  margin-bottom: 40px;
}

.header h1 {
  color: #333;
  margin-bottom: 10px;
  font-size: 2.5em;
  font-weight: 600;
}

.header p {
  color: #666;
  font-size: 1.1em;
}

.create-project-section,
.join-project-section {
  margin-bottom: 30px;
}

.create-project-section h3,
.join-project-section h3 {
  color: #333;
  margin-bottom: 20px;
  font-size: 1.3em;
  font-weight: 600;
}

.input-group {
  margin-bottom: 20px;
}

.input-group label {
  display: block;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  font-size: 14px;
}

.project-input,
.project-textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 14px;
  background-color: white;
  color: #333;
  transition: border-color 0.3s ease;
  box-sizing: border-box;
}

.project-input:focus,
.project-textarea:focus {
  outline: none;
  border-color: #667eea;
}

.project-textarea {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}

.project-type-section {
  margin-bottom: 25px;
}

.project-type-section label {
  display: block;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  font-size: 14px;
}

.type-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.type-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px;
  border: 2px solid #e1e5e9;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
}

.type-option:hover {
  border-color: #667eea;
  transform: translateY(-2px);
}

.type-option input[type="radio"] {
  display: none;
}

.type-option input[type="radio"]:checked + .type-icon {
  color: #667eea;
}

.type-option input[type="radio"]:checked ~ span {
  color: #667eea;
}

.type-option input[type="radio"]:checked {
  border-color: #667eea;
  background: #f8f9ff;
}

.type-icon {
  font-size: 1.5em;
  margin-bottom: 8px;
  color: #666;
}

.type-option span:last-child {
  font-size: 12px;
  color: #666;
  text-align: center;
}

.create-btn,
.join-btn {
  width: 100%;
  padding: 15px;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.create-btn {
  background: #28a745;
  color: white;
}

.create-btn:hover:not(:disabled) {
  background: #218838;
  transform: translateY(-2px);
}

.join-btn {
  background: #667eea;
  color: white;
}

.join-btn:hover:not(:disabled) {
  background: #5a6fd8;
  transform: translateY(-2px);
}

.create-btn:disabled,
.join-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
}

.divider {
  text-align: center;
  margin: 30px 0;
  position: relative;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: #e1e5e9;
}

.divider span {
  background: white;
  padding: 0 20px;
  color: #666;
  font-size: 14px;
}

.project-preview {
  background: #f8f9fa;
  border-radius: 15px;
  padding: 25px;
  margin-top: 30px;
}

.preview-header h4 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 1.1em;
}

.preview-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e1e5e9;
}

.preview-item:last-child {
  border-bottom: none;
}

.preview-item .label {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.preview-item .value {
  color: #666;
  font-size: 14px;
  text-align: right;
  max-width: 60%;
  word-break: break-all;
}

.preview-item .project-id {
  font-family: monospace;
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 4px;
  color: #495057;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 10px;
  text-align: center;
  margin-top: 20px;
}

.success-message {
  background: #d4edda;
  color: #155724;
  padding: 15px;
  border-radius: 10px;
  text-align: center;
  margin-top: 20px;
}

.success-actions {
  margin-top: 15px;
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.action-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 120px;
}

.action-btn.primary {
  background: linear-gradient(45deg, #23a6d5, #23d5ab);
  color: white;
}

.action-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(35, 166, 213, 0.3);
}

.action-btn.secondary {
  background: #f8f9fa;
  color: #495057;
  border: 1px solid #dee2e6;
}

.action-btn.secondary:hover {
  background: #e9ecef;
  transform: translateY(-2px);
}

@media (max-width: 1200px) {
  .project-create-card {
    max-width: 700px;
    padding: 35px;
  }
  
  .header h1 {
    font-size: 2.2em;
  }
}

@media (max-width: 768px) {
  .project-create-container {
    padding: 15px;
  }
  
  .project-create-card {
    padding: 30px 20px;
    max-width: 100%;
  }
  
  .header h1 {
    font-size: 2em;
  }
  
  .type-options {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .preview-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  
  .preview-item .value {
    max-width: 100%;
    text-align: left;
  }
}

@media (max-width: 480px) {
  .project-create-container {
    padding: 10px;
  }
  
  .project-create-card {
    padding: 25px 15px;
  }
  
  .header h1 {
    font-size: 1.8em;
  }
  
  .header p {
    font-size: 1em;
  }
  
  .project-input,
  .project-textarea {
    padding: 10px;
    font-size: 13px;
  }
  
  .type-options {
    grid-template-columns: 1fr;
  }
  
  .create-btn,
  .join-btn {
    padding: 12px;
    font-size: 14px;
  }
}
</style>

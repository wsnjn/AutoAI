<template>
  <div class="auth-container">
    <div class="auth-background">
      <div class="gradient-overlay"></div>
    </div>
    
    <div class="auth-card">
      <div class="auth-header">
        <div class="logo">
          <img src="/logo.png" alt="WSLOP Logo" class="logo-image">
          <div class="logo-subtitle">AutoAI Platform</div>
        </div>
      </div>
      
      <div class="auth-tabs">
        <button 
          class="tab-button" 
          :class="{ active: activeTab === 'login' }"
          @click="activeTab = 'login'"
        >
          登录
        </button>
        <button 
          class="tab-button" 
          :class="{ active: activeTab === 'register' }"
          @click="activeTab = 'register'"
        >
          注册
        </button>
      </div>
      
      <!-- 登录表单 -->
      <form v-if="activeTab === 'login'" @submit.prevent="handleLogin" class="auth-form">
        <div class="form-group">
          <label for="login-username">用户名</label>
          <input
            id="login-username"
            v-model="loginForm.username"
            type="text"
            placeholder="请输入用户名"
            required
          />
        </div>
        
        <div class="form-group">
          <label for="login-password">密码</label>
          <input
            id="login-password"
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            required
          />
        </div>
        
        <div class="form-options">
          <label class="checkbox-label">
            <input type="checkbox" v-model="loginForm.remember" />
            <span class="checkmark"></span>
            记住登录
          </label>
        </div>
        
        <button type="submit" class="submit-button" :disabled="loading">
          <span v-if="loading" class="loading-spinner"></span>
          {{ loading ? '登录中...' : '登录' }}
        </button>
        
        <div v-if="loginError" class="error-message">
          {{ loginError }}
        </div>
      </form>
      
      <!-- 注册表单 -->
      <form v-if="activeTab === 'register'" @submit.prevent="handleRegister" class="auth-form">
        <div class="form-group">
          <label for="register-username">用户名</label>
          <input
            id="register-username"
            v-model="registerForm.username"
            type="text"
            placeholder="请输入用户名"
            required
          />
        </div>
        
        <div class="form-group">
          <label for="register-email">邮箱</label>
          <input
            id="register-email"
            v-model="registerForm.email"
            type="email"
            placeholder="请输入邮箱"
            required
          />
        </div>
        
        <div class="form-group">
          <label for="register-password">密码</label>
          <input
            id="register-password"
            v-model="registerForm.password"
            type="password"
            placeholder="请输入密码"
            required
          />
        </div>
        
        <div class="form-group">
          <label for="register-confirm-password">确认密码</label>
          <input
            id="register-confirm-password"
            v-model="registerForm.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            required
          />
        </div>
        
        <button type="submit" class="submit-button" :disabled="loading">
          <span v-if="loading" class="loading-spinner"></span>
          {{ loading ? '注册中...' : '注册' }}
        </button>
        
        <div v-if="registerError" class="error-message">
          {{ registerError }}
        </div>
      </form>
      
      <div class="auth-footer">
        <p>欢迎使用 WSLOP AutoAI 平台</p>
        <p>开始您的智能开发之旅</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Auth',
  data() {
    return {
      activeTab: 'login',
      loading: false,
      loginForm: {
        username: '',
        password: '',
        remember: false
      },
      registerForm: {
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
      },
      loginError: '',
      registerError: ''
    }
  },
  methods: {
    async handleLogin() {
      this.loading = true
      this.loginError = ''
      
      try {
        const response = await fetch('http://39.108.142.250:3000/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: this.loginForm.username,
            password: this.loginForm.password
          })
        })
        
        const data = await response.json()
        
        if (data.success) {
          localStorage.setItem('currentUser', JSON.stringify(data.user))
          if (this.loginForm.remember) {
            localStorage.setItem('rememberLogin', 'true')
          }
          this.$router.push('/')
        } else {
          this.loginError = data.message || '登录失败，请检查用户名和密码'
        }
      } catch (error) {
        console.error('登录错误:', error)
        this.loginError = '网络错误，请稍后重试'
      } finally {
        this.loading = false
      }
    },
    
    async handleRegister() {
      this.loading = true
      this.registerError = ''
      
      if (this.registerForm.password !== this.registerForm.confirmPassword) {
        this.registerError = '两次输入的密码不一致'
        this.loading = false
        return
      }
      
      if (this.registerForm.password.length < 6) {
        this.registerError = '密码长度至少6位'
        this.loading = false
        return
      }
      
      try {
        const response = await fetch('http://39.108.142.250:3000/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: this.registerForm.username,
            email: this.registerForm.email,
            password: this.registerForm.password
          })
        })
        
        const data = await response.json()
        
        if (data.success) {
          this.activeTab = 'login'
          this.loginForm.username = this.registerForm.username
          this.loginForm.password = this.registerForm.password
          this.registerForm = {
            username: '',
            email: '',
            password: '',
            confirmPassword: ''
          }
          alert('注册成功！请登录')
        } else {
          this.registerError = data.message || '注册失败，请稍后重试'
        }
      } catch (error) {
        console.error('注册错误:', error)
        this.registerError = '网络错误，请稍后重试'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.auth-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  z-index: -2;
}

.gradient-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, 
    rgba(102, 126, 234, 0.8) 0%, 
    rgba(118, 75, 162, 0.8) 50%, 
    rgba(255, 107, 107, 0.8) 100%);
  animation: gradientShift 8s ease-in-out infinite;
  z-index: -1;
}

@keyframes gradientShift {
  0%, 100% { transform: scale(1) rotate(0deg); }
  50% { transform: scale(1.1) rotate(1deg); }
}

.auth-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 40px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.auth-header {
  text-align: center;
  margin-bottom: 30px;
}

.logo {
  margin-bottom: 20px;
}

.logo-image {
  height: 60px;
  width: auto;
  max-width: 200px;
  margin-bottom: 10px;
}

.logo-subtitle {
  font-size: 0.9rem;
  color: #666;
  font-weight: 300;
}

.auth-tabs {
  display: flex;
  margin-bottom: 30px;
  background: #f5f5f5;
  border-radius: 10px;
  padding: 4px;
}

.tab-button {
  flex: 1;
  padding: 12px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tab-button.active {
  background: white;
  color: #667eea;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.form-group input {
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 10px;
  font-size: 14px;
  transition: all 0.3s ease;
  background: white;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-options {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  display: none;
}

.checkmark {
  width: 18px;
  height: 18px;
  border: 2px solid #e1e5e9;
  border-radius: 4px;
  position: relative;
  transition: all 0.3s ease;
}

.checkbox-label input[type="checkbox"]:checked + .checkmark {
  background: #667eea;
  border-color: #667eea;
}

.checkbox-label input[type="checkbox"]:checked + .checkmark::after {
  content: '❌';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.submit-button {
  padding: 14px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
}

.submit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  padding: 12px;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 8px;
  color: #c33;
  font-size: 14px;
  text-align: center;
}

.auth-footer {
  margin-top: 30px;
  text-align: center;
  color: #666;
  font-size: 14px;
  line-height: 1.5;
}

@media (max-width: 480px) {
  .auth-card {
    margin: 20px;
    padding: 30px 20px;
  }
  
  .logo-text {
    font-size: 2rem;
  }
  
  .auth-tabs {
    margin-bottom: 25px;
  }
  
  .tab-button {
    padding: 10px;
    font-size: 13px;
  }
  
  .form-group input {
    padding: 10px 14px;
  }
  
  .submit-button {
    padding: 12px;
    font-size: 15px;
  }
}
</style>

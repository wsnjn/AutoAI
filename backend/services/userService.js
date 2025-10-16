const { pool } = require('../config/database')
const bcrypt = require('bcryptjs')

class UserService {
  // 用户注册
  async register(userData) {
    try {
      const { username, password, email } = userData
      
      // 检查用户名是否已存在
      const [existingUser] = await pool.execute(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [username, email]
      )
      
      if (existingUser.length > 0) {
        throw new Error('用户名或邮箱已存在')
      }
      
      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10)
      
      // 插入新用户
      const [result] = await pool.execute(`
        INSERT INTO users (username, password, email, role, status) 
        VALUES (?, ?, ?, 'user', 'active')
      `, [username, hashedPassword, email])
      
      // 获取新创建的用户信息（不包含密码）
      const [newUser] = await pool.execute(
        'SELECT id, username, email, avatar, role, status, created_at FROM users WHERE id = ?',
        [result.insertId]
      )
      
      return {
        success: true,
        message: '注册成功',
        user: newUser[0]
      }
      
    } catch (error) {
      return {
        success: false,
        message: error.message || '注册失败'
      }
    }
  }
  
  // 用户登录
  async login(credentials) {
    try {
      const { username, password } = credentials
      
      // 查找用户
      const [users] = await pool.execute(
        'SELECT * FROM users WHERE username = ? OR email = ?',
        [username, username]
      )
      
      if (users.length === 0) {
        throw new Error('用户不存在')
      }
      
      const user = users[0]
      
      // 检查用户状态
      if (user.status !== 'active') {
        throw new Error('用户账户已被禁用')
      }
      
      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password)
      if (!isPasswordValid) {
        throw new Error('密码错误')
      }
      
      // 更新最后登录时间
      await pool.execute(
        'UPDATE users SET last_login = NOW() WHERE id = ?',
        [user.id]
      )
      
      // 返回用户信息（不包含密码）
      const { password: _, ...userInfo } = user
      
      return {
        success: true,
        message: '登录成功',
        user: userInfo
      }
      
    } catch (error) {
      return {
        success: false,
        message: error.message || '登录失败'
      }
    }
  }
  
  // 获取用户信息
  async getUserById(userId) {
    try {
      const [users] = await pool.execute(
        'SELECT id, username, email, avatar, role, status, last_login, created_at FROM users WHERE id = ?',
        [userId]
      )
      
      if (users.length === 0) {
        throw new Error('用户不存在')
      }
      
      return {
        success: true,
        user: users[0]
      }
      
    } catch (error) {
      return {
        success: false,
        message: error.message
      }
    }
  }
  
  // 更新用户信息
  async updateUser(userId, updateData) {
    try {
      const { username, email, avatar } = updateData
      
      // 检查用户名是否已被其他用户使用
      if (username) {
        const [existingUser] = await pool.execute(
          'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?',
          [username, email, userId]
        )
        
        if (existingUser.length > 0) {
          throw new Error('用户名或邮箱已被使用')
        }
      }
      
      // 构建更新语句
      const updateFields = []
      const updateValues = []
      
      if (username) {
        updateFields.push('username = ?')
        updateValues.push(username)
      }
      if (email) {
        updateFields.push('email = ?')
        updateValues.push(email)
      }
      if (avatar) {
        updateFields.push('avatar = ?')
        updateValues.push(avatar)
      }
      
      if (updateFields.length === 0) {
        throw new Error('没有要更新的数据')
      }
      
      updateValues.push(userId)
      
      await pool.execute(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      )
      
      return {
        success: true,
        message: '用户信息更新成功'
      }
      
    } catch (error) {
      return {
        success: false,
        message: error.message || '更新失败'
      }
    }
  }
  
  // 修改密码
  async changePassword(userId, oldPassword, newPassword) {
    try {
      // 获取用户当前密码
      const [users] = await pool.execute(
        'SELECT password FROM users WHERE id = ?',
        [userId]
      )
      
      if (users.length === 0) {
        throw new Error('用户不存在')
      }
      
      // 验证旧密码
      const isOldPasswordValid = await bcrypt.compare(oldPassword, users[0].password)
      if (!isOldPasswordValid) {
        throw new Error('原密码错误')
      }
      
      // 加密新密码
      const hashedNewPassword = await bcrypt.hash(newPassword, 10)
      
      // 更新密码
      await pool.execute(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedNewPassword, userId]
      )
      
      return {
        success: true,
        message: '密码修改成功'
      }
      
    } catch (error) {
      return {
        success: false,
        message: error.message || '密码修改失败'
      }
    }
  }
  
  // 获取所有用户列表（管理员功能）
  async getAllUsers() {
    try {
      const [users] = await pool.execute(
        'SELECT id, username, email, avatar, role, status, last_login, created_at FROM users ORDER BY created_at DESC'
      )
      
      return {
        success: true,
        users
      }
      
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取用户列表失败'
      }
    }
  }
}

module.exports = new UserService()

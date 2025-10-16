const { pool } = require('../config/database')
const crypto = require('crypto')

class ProjectService {
  constructor() {
    this.initializeTables()
  }

  async initializeTables() {
    try {
      console.log('🔧 初始化项目相关数据表...')
      
      // 项目相关表已经在reset-database.js中创建
      // 这里只需要检查表是否存在
      const [tables] = await pool.execute("SHOW TABLES LIKE 'projects'")
      if (tables.length === 0) {
        console.log('⚠️ 项目表不存在，请先运行 reset-database.js')
        throw new Error('项目表不存在')
      }
      
      console.log('✅ 项目相关数据表检查完成')
    } catch (error) {
      console.error('❌ 初始化项目数据表失败:', error)
      throw error
    }
  }

  generateProjectId() {
    // 生成8位随机ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  async createProject(projectData) {
    try {
      console.log('🚀 开始创建新项目...')
      console.log('📊 项目数据:', projectData)
      
      const projectId = this.generateProjectId()
      const { name, description, type, createdBy, createdById, members, memberIds } = projectData
      
      // 检查项目名称是否已存在
      const [existingProjects] = await pool.execute(
        'SELECT id FROM projects WHERE name = ? AND status = "active"',
        [name]
      )
      
      if (existingProjects.length > 0) {
        throw new Error('项目名称已存在，请选择其他名称')
      }
      
             // 创建项目
       const membersArray = members && members.length > 0 ? members : [createdBy]
       const memberIdsArray = memberIds && memberIds.length > 0 ? memberIds : [createdById]
       const settingsObject = {
         allowJoin: true,
         maxMembers: 10,
         fileTypes: ['js', 'ts', 'jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'json', 'md', 'txt']
       }
       
       console.log('👤 创建者信息:', { createdBy, createdById })
       console.log('👥 成员信息:', { membersArray, memberIdsArray })
       
       const [result] = await pool.execute(
         `INSERT INTO projects (id, name, description, type, created_by, created_by_id, members, member_ids, settings, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
         [
           projectId,
           name,
           description || null,
           type,
           createdBy,
           createdById,
           JSON.stringify(membersArray),
           JSON.stringify(memberIdsArray),
           JSON.stringify(settingsObject)
         ]
       )
      
      // 添加创建者为项目所有者
      await pool.execute(
        'INSERT INTO project_members (project_id, user_id, username, role, permissions, status, joined_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [
          projectId,
          createdById,
          createdBy,
          'owner',
          JSON.stringify({
            canEdit: true,
            canDelete: true,
            canInvite: true,
            canManageFiles: true,
            canViewLogs: true
          }),
          'active'
        ]
      )
      
             // 创建项目文件表
       const tableResult = await this.createProjectFileTable(name, projectId)
       if (!tableResult.success) {
         console.warn('⚠️ 项目文件表创建失败:', tableResult.error)
       }
       
       // 记录项目创建日志
       await this.logProjectActivity(projectId, createdBy, 'project_created', {
         projectName: name,
         projectType: type,
         description: description,
         tableName: tableResult.tableName
       })
      
      // 获取创建的项目信息
      const [projects] = await pool.execute(
        'SELECT * FROM projects WHERE id = ?',
        [projectId]
      )
      
      const project = projects[0]
      try {
        project.members = JSON.parse(project.members)
      } catch (error) {
        console.warn('⚠️ 解析members字段失败，使用默认值:', error.message)
        project.members = [createdBy]
      }
      try {
        project.settings = JSON.parse(project.settings)
      } catch (error) {
        console.warn('⚠️ 解析settings字段失败，使用默认值:', error.message)
        project.settings = {
          allowJoin: true,
          maxMembers: 10,
          fileTypes: ['js', 'ts', 'jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'json', 'md', 'txt']
        }
      }
      
      console.log('✅ 项目创建成功:', project)
      
      return {
        success: true,
        data: project,
        message: '项目创建成功'
      }
    } catch (error) {
      console.error('❌ 创建项目失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async joinProject(projectId, userId, username) {
    try {
      console.log('🚀 开始加入项目...')
      console.log('🆔 项目ID:', projectId)
      console.log('👤 用户ID:', userId)
      
      // 检查项目是否存在
      const [projects] = await pool.execute(
        'SELECT * FROM projects WHERE id = ?',
        [projectId]
      )
      
      if (projects.length === 0) {
        throw new Error('项目不存在或已被删除')
      }
      
      const project = projects[0]
      
      // 检查用户是否已经是项目成员
      const [existingMembers] = await pool.execute(
        'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?',
        [projectId, userId]
      )
      
      if (existingMembers.length > 0) {
        const member = existingMembers[0]
        if (member.status === 'active') {
          throw new Error('您已经是该项目成员')
        } else {
          // 重新激活成员身份
          await pool.execute(
            'UPDATE project_members SET status = "active" WHERE project_id = ? AND user_id = ?',
            [projectId, userId]
          )
        }
      } else {
        let settings
        try {
          settings = JSON.parse(project.settings)
        } catch (error) {
          console.warn('⚠️ 解析settings字段失败，使用默认值:', error.message)
          settings = {
            allowJoin: true,
            maxMembers: 10,
            fileTypes: ['js', 'ts', 'jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'json', 'md', 'txt']
          }
        }
        
        // 检查是否允许加入
        if (!settings.allowJoin) {
          throw new Error('该项目不允许新成员加入')
        }
        
        // 检查项目成员数量限制
        const [memberCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM project_members WHERE project_id = ? AND status = "active"',
          [projectId]
        )
        
        if (memberCount[0].count >= settings.maxMembers) {
          throw new Error(`项目成员数量已达上限 (${settings.maxMembers}人)`)
        }
        
        // 添加新成员
        await pool.execute(
          'INSERT INTO project_members (project_id, user_id, username, role, permissions) VALUES (?, ?, ?, ?, ?)',
          [
            projectId,
            userId,
            username || userId,
            'member',
            JSON.stringify({
              canEdit: true,
              canDelete: false,
              canInvite: false,
              canManageFiles: true,
              canViewLogs: false
            })
          ]
        )
      }
      
      // 更新项目成员列表
      const [members] = await pool.execute(
        'SELECT user_id FROM project_members WHERE project_id = ? AND status = "active"',
        [projectId]
      )
      
      const memberIds = members.map(m => m.user_id)
      await pool.execute(
        'UPDATE projects SET members = ? WHERE id = ?',
        [JSON.stringify(memberIds), projectId]
      )
      
      // 记录加入项目日志
      await this.logProjectActivity(projectId, userId, 'member_joined', {
        userId: userId
      })
      
      // 获取完整的项目信息
      const [updatedProjects] = await pool.execute(
        'SELECT * FROM projects WHERE id = ?',
        [projectId]
      )
      
      const updatedProject = updatedProjects[0]
      try {
        updatedProject.members = JSON.parse(updatedProject.members)
      } catch (error) {
        console.warn('⚠️ 解析members字段失败，使用默认值:', error.message)
        updatedProject.members = [userId]
      }
      try {
        updatedProject.settings = JSON.parse(updatedProject.settings)
      } catch (error) {
        console.warn('⚠️ 解析settings字段失败，使用默认值:', error.message)
        updatedProject.settings = {
          allowJoin: true,
          maxMembers: 10,
          fileTypes: ['js', 'ts', 'jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'json', 'md', 'txt']
        }
      }
      
      console.log('✅ 成功加入项目:', updatedProject)
      
      return {
        success: true,
        data: updatedProject,
        message: '成功加入项目'
      }
    } catch (error) {
      console.error('❌ 加入项目失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async getProject(projectId) {
    try {
      console.log('🔍 查询项目信息...')
      console.log('🆔 项目ID:', projectId)
      
      const [projects] = await pool.execute(
        'SELECT * FROM projects WHERE id = ?',
        [projectId]
      )
      
      if (projects.length === 0) {
        throw new Error('项目不存在')
      }
      
      const project = projects[0]
      try {
        project.members = JSON.parse(project.members)
      } catch (error) {
        console.warn('⚠️ 解析members字段失败，使用默认值:', error.message)
        project.members = []
      }
      try {
        project.settings = JSON.parse(project.settings)
      } catch (error) {
        console.warn('⚠️ 解析settings字段失败，使用默认值:', error.message)
        project.settings = {
          allowJoin: true,
          maxMembers: 10,
          fileTypes: ['js', 'ts', 'jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'json', 'md', 'txt']
        }
      }
      
      // 获取项目成员详细信息
      const [members] = await pool.execute(
        `SELECT pm.*, p.name as project_name 
         FROM project_members pm 
         JOIN projects p ON pm.project_id = p.id 
         WHERE pm.project_id = ? AND pm.status = "active"`,
        [projectId]
      )
      
      project.memberDetails = members
      
      console.log('✅ 项目信息查询成功:', project)
      
      return {
        success: true,
        data: project
      }
    } catch (error) {
      console.error('❌ 查询项目失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async getProjectMemberCount(projectId) {
    try {
      console.log('🔍 查询项目成员数量...')
      console.log('🆔 项目ID:', projectId)
      
      // 检查项目是否存在
      const [projects] = await pool.execute(
        'SELECT id FROM projects WHERE id = ? AND status = "active"',
        [projectId]
      )
      
      if (projects.length === 0) {
        throw new Error('项目不存在')
      }
      
      // 统计活跃成员数量
      const [memberCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM project_members WHERE project_id = ? AND status = "active"',
        [projectId]
      )
      
      const count = memberCount[0].count
      console.log('✅ 项目成员数量查询成功:', count)
      
      // 调试信息：查看所有成员记录
      const [allMembers] = await pool.execute(
        'SELECT * FROM project_members WHERE project_id = ?',
        [projectId]
      )
      console.log(`项目 ${projectId} 的所有成员记录:`, allMembers)
      
      return {
        success: true,
        data: count
      }
    } catch (error) {
      console.error('❌ 查询项目成员数量失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async getUserProjects(userId) {
    try {
      console.log('🔍 查询用户项目列表...')
      console.log('👤 用户ID:', userId)
      
      const [projects] = await pool.execute(
        `SELECT p.*, pm.role, pm.joined_at 
         FROM projects p 
         JOIN project_members pm ON p.id = pm.project_id 
         WHERE pm.user_id = ? AND p.status = "active" AND pm.status = "active"
         ORDER BY pm.joined_at DESC`,
        [userId]
      )
      
      const formattedProjects = projects.map(project => {
        let members, settings
        try {
          members = JSON.parse(project.members)
        } catch (error) {
          console.warn('⚠️ 解析members字段失败，使用默认值:', error.message)
          members = []
        }
        try {
          settings = JSON.parse(project.settings)
        } catch (error) {
          console.warn('⚠️ 解析settings字段失败，使用默认值:', error.message)
          settings = {
            allowJoin: true,
            maxMembers: 10,
            fileTypes: ['js', 'ts', 'jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'json', 'md', 'txt']
          }
        }
        return {
          ...project,
          members,
          settings
        }
      })
      
      console.log('✅ 用户项目列表查询成功:', formattedProjects)
      
      return {
        success: true,
        data: formattedProjects
      }
    } catch (error) {
      console.error('❌ 查询用户项目失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async logProjectActivity(projectId, userId, action, details = {}) {
    try {
      await pool.execute(
        'INSERT INTO project_logs (project_id, user_id, action, details) VALUES (?, ?, ?, ?)',
        [projectId, userId, action, JSON.stringify(details)]
      )
      
      console.log(`📝 项目活动日志记录: ${action}`, details)
    } catch (error) {
      console.error('❌ 记录项目活动日志失败:', error)
    }
  }

  async getProjectLogs(projectId, limit = 50) {
    try {
      const [logs] = await pool.execute(
        `SELECT pl.*, p.name as project_name 
         FROM project_logs pl 
         JOIN projects p ON pl.project_id = p.id 
         WHERE pl.project_id = ? 
         ORDER BY pl.created_at DESC 
         LIMIT ${limit}`,
        [projectId]
      )
      
      return {
        success: true,
        data: logs.map(log => {
          try {
            return {
              ...log,
              details: log.details ? JSON.parse(log.details) : {}
            }
          } catch (parseError) {
            console.warn(`⚠️ 解析日志详情失败，使用原始数据:`, parseError.message)
            return {
              ...log,
              details: log.details || {}
            }
          }
        })
      }
    } catch (error) {
      console.error('❌ 查询项目日志失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 动态创建项目文件表
  async createProjectFileTable(projectName, projectId) {
    try {
      console.log(`🔧 为项目 "${projectName}" 创建文件表...`)
      
      // 生成安全的表名（移除特殊字符，限制长度）
      const safeTableName = this.generateSafeTableName(projectName)
      
      // 检查表是否已存在
      const [existingTables] = await pool.execute(`SHOW TABLES LIKE '${safeTableName}'`)
      if (existingTables.length > 0) {
        console.log(`✅ 项目文件表 "${safeTableName}" 已存在`)
        return {
          success: true,
          tableName: safeTableName,
          message: '项目文件表已存在'
        }
      }
      
      const createProjectFileTable = `
        CREATE TABLE IF NOT EXISTS \`${safeTableName}\` (
          id INT AUTO_INCREMENT PRIMARY KEY COMMENT '文件记录唯一标识符',
          file_path VARCHAR(500) NOT NULL COMMENT '文件完整路径',
          file_name VARCHAR(255) NOT NULL COMMENT '文件名（不含路径）',
          item_type ENUM('folder', 'file') NOT NULL COMMENT '项目类型（文件夹、文件）',
          file_type VARCHAR(50) COMMENT '文件类型扩展名（如txt、vue、js等）',
          file_size BIGINT DEFAULT 0 COMMENT '文件大小（字节）',
          content LONGTEXT COMMENT '文件内容（文本文件）',
          parent_path VARCHAR(500) COMMENT '父目录路径',
          depth INT DEFAULT 0 COMMENT '目录层级深度',
          child_count INT DEFAULT 0 COMMENT '子项目数量（文件夹下的文件和子文件夹总数）',
          file_count INT DEFAULT 0 COMMENT '文件数量（文件夹下的文件数量）',
          folder_count INT DEFAULT 0 COMMENT '文件夹数量（文件夹下的子文件夹数量）',
          last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          created_by VARCHAR(100) COMMENT '创建者用户ID',
          status ENUM('active', 'deleted') DEFAULT 'active' COMMENT '项目状态（活跃、已删除）',
          UNIQUE KEY unique_path (file_path, status),
          INDEX idx_file_path (file_path(255)),
          INDEX idx_file_name (file_name),
          INDEX idx_item_type (item_type),
          INDEX idx_file_type (file_type),
          INDEX idx_parent_path (parent_path(255)),
          INDEX idx_status (status),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目文件存储表'
      `
      
      await pool.execute(createProjectFileTable)
      
      // 记录表创建日志
      await this.logProjectActivity(projectId, 'system', 'table_created', {
        tableName: safeTableName,
        projectName: projectName,
        description: '项目文件表创建'
      })
      
      console.log(`✅ 项目文件表 "${safeTableName}" 创建成功`)
      
      return {
        success: true,
        tableName: safeTableName,
        message: '项目文件表创建成功'
      }
    } catch (error) {
      console.error('❌ 创建项目文件表失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 生成安全的表名
  generateSafeTableName(projectName) {
    // 移除特殊字符，只保留字母、数字、下划线
    let safeName = projectName.replace(/[^a-zA-Z0-9_]/g, '_')
    
    // 确保表名以字母开头
    if (!/^[a-zA-Z]/.test(safeName)) {
      safeName = 'project_' + safeName
    }
    
    // 限制长度（MySQL表名最大64字符）
    if (safeName.length > 60) {
      safeName = safeName.substring(0, 60)
    }
    
    // 不再添加时间戳，确保同一项目使用相同表名
    return safeName.toLowerCase()
  }

  // 获取文件夹对应的数据表名
  getFolderTableName(projectName, parentPath) {
    try {
      // 解析父路径，构建完整的层级表名
      const pathParts = parentPath.split('/').filter(part => part.trim() !== '')
      
      const safeProjectName = this.generateSafeTableName(projectName)
      const safePathParts = pathParts.map(part => part.replace(/[^a-zA-Z0-9_]/g, '_'))
      const folderTableName = `${safeProjectName}__${safePathParts.join('__')}`
      
      console.log(`🔍 解析文件夹表名: ${parentPath} -> ${folderTableName}`)
      return folderTableName
    } catch (error) {
      console.error('❌ 解析文件夹表名失败:', error)
      return null
    }
  }

  // 保存项目项到文件夹数据表
  async saveItemToFolderTable(projectId, folderTableName, itemData, projectName) {
    try {
      console.log(`💾 保存项目项到文件夹数据表 "${folderTableName}"...`)
      
      // 检查表是否存在
      const [existingTables] = await pool.execute(`SHOW TABLES LIKE '${folderTableName}'`)
      if (existingTables.length === 0) {
        console.log(`⚠️ 文件夹数据表 "${folderTableName}" 不存在，创建新表`)
        
        // 解析文件夹路径和名称
        const pathParts = (itemData.parent_path || '').split('/').filter(part => part.trim() !== '')
        const folderName = pathParts[pathParts.length - 1] || 'root'
        
        // 创建文件夹数据表
        const createResult = await this.createFolderDataTable(projectId, projectName, itemData.parent_path || '', folderName)
        if (!createResult.success) {
          console.log(`❌ 创建文件夹数据表失败: ${createResult.error}`)
          return {
            success: false,
            error: `创建文件夹数据表失败: ${createResult.error}`
          }
        }
        
        console.log(`✅ 文件夹数据表创建成功: ${folderTableName}`)
      }
      
      // 修复：在文件夹表中，parent_path应该为空，file_path也应该只包含文件名
      const modifiedItemData = {
        ...itemData,
        parent_path: null,
        file_path: `/${itemData.file_name}` // 确保file_path只包含文件名
      };
      
      // 检查项目项是否已存在
      const [existingItems] = await pool.execute(
        `SELECT id FROM \`${folderTableName}\` WHERE file_path = ? AND status = 'active'`,
        [modifiedItemData.file_path]
      )
      
      if (existingItems.length > 0) {
        // 更新现有项目项
        await pool.execute(
          `UPDATE \`${folderTableName}\` SET 
           file_name = ?, item_type = ?, file_type = ?, file_size = ?, content = ?, 
           parent_path = ?, depth = ?, last_modified = CURRENT_TIMESTAMP 
           WHERE file_path = ? AND status = 'active'`,
          [
            modifiedItemData.file_name, modifiedItemData.item_type, modifiedItemData.file_type, modifiedItemData.file_size,
            modifiedItemData.content, modifiedItemData.parent_path, modifiedItemData.depth, modifiedItemData.file_path
          ]
        )
        console.log(`✅ 项目项在文件夹数据表中更新成功`)
      } else {
        // 插入新项目项
        await pool.execute(
          `INSERT INTO \`${folderTableName}\` 
           (file_path, file_name, item_type, file_type, file_size, content, parent_path, depth, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            modifiedItemData.file_path, modifiedItemData.file_name, modifiedItemData.item_type, modifiedItemData.file_type,
            modifiedItemData.file_size, modifiedItemData.content, modifiedItemData.parent_path, modifiedItemData.depth, modifiedItemData.created_by
          ]
        )
        console.log(`✅ 项目项保存到文件夹数据表成功`)
      }
      
      return {
        success: true,
        message: '项目项保存到文件夹数据表成功'
      }
    } catch (error) {
      console.error('❌ 保存项目项到文件夹数据表失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 为文件夹创建独立的数据表
  async createFolderDataTable(projectId, projectName, folderPath, folderName) {
    try {
      console.log(`🔧 为文件夹 "${folderName}" 创建独立数据表...`)
      
      // 生成文件夹表名：项目名__完整路径层级
      const safeProjectName = this.generateSafeTableName(projectName)
      
      // 解析文件夹路径，构建完整的层级表名
      const pathParts = folderPath.split('/').filter(part => part.trim() !== '')
      const safePathParts = pathParts.map(part => part.replace(/[^a-zA-Z0-9_]/g, '_'))
      const folderTableName = `${safeProjectName}__${safePathParts.join('__')}`
      
      // 检查表是否已存在
      const [existingTables] = await pool.execute(`SHOW TABLES LIKE '${folderTableName}'`)
      if (existingTables.length > 0) {
        console.log(`✅ 文件夹数据表 "${folderTableName}" 已存在`)
        return {
          success: true,
          tableName: folderTableName,
          message: '文件夹数据表已存在'
        }
      }
      
      const createFolderTableSQL = `
        CREATE TABLE IF NOT EXISTS \`${folderTableName}\` (
          id INT AUTO_INCREMENT PRIMARY KEY COMMENT '文件夹内容记录唯一标识符',
          file_path VARCHAR(500) NOT NULL COMMENT '文件完整路径',
          file_name VARCHAR(255) NOT NULL COMMENT '文件名（不含路径）',
          item_type ENUM('folder', 'file') NOT NULL COMMENT '项目类型（文件夹、文件）',
          file_type VARCHAR(50) COMMENT '文件类型扩展名（如txt、vue、js等）',
          file_size BIGINT DEFAULT 0 COMMENT '文件大小（字节）',
          content LONGTEXT COMMENT '文件内容（文本文件）',
          parent_path VARCHAR(500) COMMENT '父目录路径',
          depth INT DEFAULT 0 COMMENT '目录层级深度',
          child_count INT DEFAULT 0 COMMENT '子项目数量（文件夹下的文件和子文件夹总数）',
          file_count INT DEFAULT 0 COMMENT '文件数量（文件夹下的文件数量）',
          folder_count INT DEFAULT 0 COMMENT '文件夹数量（文件夹下的子文件夹数量）',
          last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          created_by VARCHAR(100) COMMENT '创建者用户ID',
          status ENUM('active', 'deleted') DEFAULT 'active' COMMENT '项目状态（活跃、已删除）',
          UNIQUE KEY unique_path (file_path, status),
          INDEX idx_file_path (file_path(255)),
          INDEX idx_file_name (file_name),
          INDEX idx_item_type (item_type),
          INDEX idx_file_type (file_type),
          INDEX idx_parent_path (parent_path(255)),
          INDEX idx_status (status),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件夹内容存储表'
      `
      
      await pool.execute(createFolderTableSQL)
      
      // 记录文件夹表创建日志
      await this.logProjectActivity(projectId, 'system', 'folder_table_created', {
        folderTableName: folderTableName,
        folderPath: folderPath,
        folderName: folderName,
        projectName: projectName,
        description: '文件夹独立数据表创建'
      })
      
      console.log(`✅ 文件夹数据表 "${folderTableName}" 创建成功`)
      
      return {
        success: true,
        tableName: folderTableName,
        message: '文件夹数据表创建成功'
      }
    } catch (error) {
      console.error('❌ 创建文件夹数据表失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 保存项目项到项目表（文件夹或文件）
  async saveItemToProject(projectId, projectName, itemData) {
    try {
      console.log(`💾 保存项目项到项目 "${projectName}"...`)
      console.log('📊 项目项数据:', itemData)
      
      // 获取或创建项目文件表
      const tableResult = await this.createProjectFileTable(projectName, projectId)
      if (!tableResult.success) {
        throw new Error(tableResult.error)
      }
      
      const tableName = tableResult.tableName
      
      // 检查项目项是否已存在
      const [existingItems] = await pool.execute(
        `SELECT id FROM \`${tableName}\` WHERE file_path = ? AND status = 'active'`,
        [itemData.file_path]
      )
      
      if (existingItems.length > 0) {
        // 更新现有项目项
        const updateFields = [
          'file_name = ?',
          'item_type = ?',
          'file_type = ?',
          'file_size = ?',
          'content = ?',
          'parent_path = ?',
          'depth = ?',
          'child_count = ?',
          'file_count = ?',
          'folder_count = ?',
          'last_modified = CURRENT_TIMESTAMP'
        ]
        
        await pool.execute(
          `UPDATE \`${tableName}\` SET ${updateFields.join(', ')} WHERE file_path = ? AND status = 'active'`,
          [
            itemData.file_name,
            itemData.item_type,
            itemData.file_type || null,
            itemData.file_size || 0,
            itemData.content || null,
            itemData.parent_path || null,
            itemData.depth || 0,
            itemData.child_count || 0,
            itemData.file_count || 0,
            itemData.folder_count || 0,
            itemData.file_path
          ]
        )
        console.log(`✅ 项目项 "${itemData.file_name}" 更新成功`)
      } else {
        // 插入新项目项
        await pool.execute(
          `INSERT INTO \`${tableName}\` 
           (file_path, file_name, item_type, file_type, file_size, content, parent_path, depth, 
            child_count, file_count, folder_count, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemData.file_path,
            itemData.file_name,
            itemData.item_type,
            itemData.file_type || null,
            itemData.file_size || 0,
            itemData.content || null,
            itemData.parent_path || null,
            itemData.depth || 0,
            itemData.child_count || 0,
            itemData.file_count || 0,
            itemData.folder_count || 0,
            itemData.created_by || 'system'
          ]
        )
        console.log(`✅ 项目项 "${itemData.file_name}" 保存成功`)
      }
      
      // 如果是文件夹，更新父文件夹的计数
      if (itemData.parent_path) {
        await this.updateParentFolderCounts(tableName, itemData.parent_path)
      }
      
      return {
        success: true,
        tableName: tableName,
        message: '项目项保存成功'
      }
    } catch (error) {
      console.error('❌ 保存项目项到项目失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  // 更新父文件夹的计数
  async updateParentFolderCounts(tableName, parentPath) {
    try {
      // 获取父文件夹下的所有子项目
      const [children] = await pool.execute(
        `SELECT item_type FROM \`${tableName}\` WHERE parent_path = ? AND status = 'active'`,
        [parentPath]
      )
      
      const childCount = children.length
      const fileCount = children.filter(child => child.item_type === 'file').length
      const folderCount = children.filter(child => child.item_type === 'folder').length
      
      // 更新父文件夹的计数
      await pool.execute(
        `UPDATE \`${tableName}\` SET 
         child_count = ?, file_count = ?, folder_count = ?, last_modified = CURRENT_TIMESTAMP 
         WHERE file_path = ? AND status = 'active'`,
        [childCount, fileCount, folderCount, parentPath]
      )
      
      console.log(`📊 更新父文件夹 "${parentPath}" 计数: 子项目=${childCount}, 文件=${fileCount}, 文件夹=${folderCount}`)
    } catch (error) {
      console.error('❌ 更新父文件夹计数失败:', error)
    }
  }

  // 获取项目文件列表
  async getProjectFiles(projectId, projectName, parentPath = null) {
    try {
      console.log(`📋 获取项目 "${projectName}" 的项目项列表...`)
      if (parentPath) {
        console.log(`📂 父路径: ${parentPath}`)
      }
      
      // 如果有父路径，需要递归查找正确的数据表
      if (parentPath) {
        // 尝试从主项目表获取指定父路径下的项目项
        const safeTableName = this.generateSafeTableName(projectName)
        console.log(`🔍 尝试从主项目表 "${safeTableName}" 获取 parent_path = "${parentPath}" 的项目...`)
        
        // 检查主项目表是否存在
        const [tables] = await pool.execute(`SHOW TABLES LIKE '${safeTableName}'`)
        if (tables.length > 0) {
          // 从主项目表获取指定父路径下的项目项
          const query = `SELECT * FROM \`${safeTableName}\` WHERE parent_path = ? ORDER BY item_type DESC, file_name ASC`
          console.log(`🔍 执行查询: ${query} 参数: [${parentPath}]`)
          const [items] = await pool.execute(query, [parentPath])
          
          console.log(`✅ 从主项目表获取到 ${items.length} 个项目项`)
          items.forEach(item => {
            const type = item.item_type === 'folder' ? '📁' : '📄';
            console.log(`  ${type} ${item.file_name} (${item.file_path}) - 父路径: ${item.parent_path}`);
          })
          
          if (items.length > 0) {
            return {
              success: true,
              data: items,
              tableName: safeTableName
            }
          }
        }
        
        // 如果主项目表中没有找到，尝试从文件夹数据表中获取
        const folderTableName = this.getFolderTableName(projectName, parentPath)
        if (folderTableName) {
          console.log(`🔍 尝试从文件夹数据表 "${folderTableName}" 获取文件...`)
          
          // 检查文件夹表是否存在
          const [folderTables] = await pool.execute(`SHOW TABLES LIKE '${folderTableName}'`)
          if (folderTables.length > 0) {
            // 从文件夹表中获取文件
            const query = `SELECT * FROM \`${folderTableName}\` ORDER BY item_type DESC, file_name ASC`
            console.log(`🔍 执行查询: ${query}`)
            const [items] = await pool.execute(query)
            
            console.log(`✅ 从文件夹数据表获取到 ${items.length} 个项目项`)
            items.forEach(item => {
              const type = item.item_type === 'folder' ? '📁' : '📄';
              console.log(`  ${type} ${item.file_name} (${item.file_path}) - 父路径: ${item.parent_path}`);
            })
            
            return {
              success: true,
              data: items,
              tableName: folderTableName
            }
          }
        }
        
        // 如果都没有找到，返回空列表
        console.log(`⚠️ 在父路径 "${parentPath}" 下未找到任何项目项`)
        return {
          success: true,
          data: [],
          message: '未找到项目项'
        }
      }
      
      // 如果没有父路径，从主项目表和所有文件夹数据表获取根目录项目项
      const safeTableName = this.generateSafeTableName(projectName)
      let allItems = []
      
      // 1. 从主项目表获取根目录项目项
      const [tables] = await pool.execute(`SHOW TABLES LIKE '${safeTableName}'`)
      if (tables.length > 0) {
        const query = `SELECT * FROM \`${safeTableName}\` WHERE (parent_path IS NULL OR parent_path = '') ORDER BY item_type DESC, file_name ASC`
        const [items] = await pool.execute(query)
        allItems = allItems.concat(items)
        console.log(`✅ 从主项目表获取到 ${items.length} 个项目项`)
      }
      
      // 2. 从所有文件夹数据表获取根目录项目项
      const folderTablePattern = `${safeTableName}__`
      const [folderTables] = await pool.execute(`SHOW TABLES LIKE '${folderTablePattern}%'`)
      
      for (const table of folderTables) {
        const tableName = Object.values(table)[0]
        console.log(`🔍 检查文件夹数据表: ${tableName}`)
        
        // 获取根目录下的项目项（parent_path为null、空或'/'）
        const query = `SELECT * FROM \`${tableName}\` WHERE (parent_path IS NULL OR parent_path = '' OR parent_path = '/') ORDER BY item_type DESC, file_name ASC`
        const [items] = await pool.execute(query)
        
        if (items.length > 0) {
          allItems = allItems.concat(items)
          console.log(`✅ 从文件夹数据表 "${tableName}" 获取到 ${items.length} 个项目项`)
          items.forEach(item => {
            const type = item.item_type === 'folder' ? '📁' : '📄';
            console.log(`  ${type} ${item.file_name} (${item.file_path}) - 父路径: ${item.parent_path}`);
          })
        }
      }
      
      // 3. 按类型和名称排序
      allItems.sort((a, b) => {
        if (a.item_type !== b.item_type) {
          return a.item_type === 'folder' ? -1 : 1
        }
        return a.file_name.localeCompare(b.file_name)
      })
      
      console.log(`📊 总共获取到 ${allItems.length} 个项目项`)
      
      return {
        success: true,
        data: allItems,
        tableName: safeTableName
      }
    } catch (error) {
      console.error('❌ 获取项目文件失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 获取文件内容
  async getFileContent(projectId, projectName, filePath) {
    try {
      console.log(`📄 获取文件内容: ${filePath}`)
      
      // 1. 从主项目表查找
      const safeTableName = this.generateSafeTableName(projectName)
      const [tables] = await pool.execute(`SHOW TABLES LIKE '${safeTableName}'`)
      
      if (tables.length > 0) {
        const query = `SELECT * FROM \`${safeTableName}\` WHERE file_path = ?`
        const [items] = await pool.execute(query, [filePath])
        
        if (items.length > 0) {
          console.log(`✅ 从主项目表找到文件: ${filePath}`)
          return {
            success: true,
            data: items[0]
          }
        }
      }
      
      // 2. 从所有文件夹数据表查找
      const folderTablePattern = `${safeTableName}__`
      const [folderTables] = await pool.execute(`SHOW TABLES LIKE '${folderTablePattern}%'`)
      
      for (const table of folderTables) {
        const tableName = Object.values(table)[0]
        
        // 尝试原始路径
        let query = `SELECT * FROM \`${tableName}\` WHERE file_path = ?`
        let [items] = await pool.execute(query, [filePath])
        
        // 如果没找到，尝试去掉目录前缀的路径
        if (items.length === 0) {
          // 提取文件名部分
          const fileName = filePath.split('/').pop()
          const simplifiedPath = `/${fileName}`
          
          query = `SELECT * FROM \`${tableName}\` WHERE file_path = ?`
          items = await pool.execute(query, [simplifiedPath])
        }
        
        if (items.length > 0) {
          console.log(`✅ 从文件夹数据表 "${tableName}" 找到文件: ${filePath}`)
          console.log(`🔍 子表查询结果类型:`, typeof items[0], Array.isArray(items[0]))
          console.log(`🔍 子表查询结果:`, items[0])
          
          // 确保返回的是对象而不是数组
          const fileData = Array.isArray(items[0]) ? items[0][0] : items[0]
          if (!fileData) {
            console.log(`❌ 子表文件数据为空: ${filePath}`)
            continue
          }
          return {
            success: true,
            data: fileData
          }
        }
      }
      
      console.log(`❌ 文件未找到: ${filePath}`)
      return {
        success: false,
        error: '文件不存在'
      }
      
    } catch (error) {
      console.error('❌ 获取文件内容失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 获取项目文件树结构
  async getProjectFileTree(projectId, projectName) {
    try {
      console.log(`🌳 获取项目 "${projectName}" 的文件树结构...`)
      
      const safeTableName = this.generateSafeTableName(projectName)
      
      // 获取所有相关的表
      const [allTables] = await pool.execute(`SHOW TABLES LIKE '${safeTableName}%'`)
      console.log(`📊 找到 ${allTables.length} 个相关表`)
      
      const fileTree = []
      
      // 处理主项目表（根级文件）
      const [mainItems] = await pool.execute(`SELECT * FROM \`${safeTableName}\` WHERE file_path NOT LIKE '%-deleted-%' ORDER BY file_name ASC`)
      console.log(`📄 主项目表文件数量: ${mainItems.length}`)
      
      // 添加根级文件
      mainItems.forEach(item => {
        fileTree.push({
          ...item,
          children: []
        })
      })
      
      // 处理文件夹表
      for (const tableRow of allTables) {
        const tableName = Object.values(tableRow)[0]
        
        if (tableName === safeTableName) {
          continue // 跳过主项目表
        }
        
        console.log(`🔍 处理文件夹表: ${tableName}`)
        
        try {
          const [folderItems] = await pool.execute(`SELECT * FROM \`${tableName}\` WHERE file_path NOT LIKE '%-deleted-%' ORDER BY file_name ASC`)
          
          if (folderItems.length > 0) {
            // 解析表名获取文件夹路径
            // my_project__src -> src
            // my_project__src__components -> src/components
            const folderPath = tableName.replace(safeTableName + '__', '').replace(/_/g, '/')
            const folderName = folderPath.split('/').pop()
            
            // 修复双斜杠问题
            const cleanFolderPath = folderPath.replace(/\/+/g, '/')
            
            console.log(`📁 创建文件夹: ${folderName}, 路径: /${cleanFolderPath}, 文件数量: ${folderItems.length}`)
            
            // 创建文件夹节点
            const folderNode = {
              id: `folder_${folderName}`,
              file_path: '/' + cleanFolderPath,
              file_name: folderName,
              item_type: 'folder',
              file_type: null,
              file_size: 0,
              content: null,
              parent_path: null,
              depth: cleanFolderPath.split('/').length,
              child_count: folderItems.length,
              file_count: folderItems.length,
              folder_count: 0,
              last_modified: new Date().toISOString(),
              created_at: new Date().toISOString(),
              created_by: 'system',
              status: 'active',
              children: folderItems.map(item => ({
                ...item,
                file_path: '/' + cleanFolderPath + '/' + item.file_name, // 设置正确的文件路径
                children: []
              }))
            }
            
            // 添加到文件树
            fileTree.push(folderNode)
            console.log(`✅ 处理文件夹 "${folderName}"，包含 ${folderItems.length} 个文件`)
          }
        } catch (error) {
          console.warn(`⚠️ 处理文件夹表 "${tableName}" 失败:`, error.message)
        }
      }
      
      // 按类型和名称排序
      const sortItems = (items) => {
        return items.sort((a, b) => {
          // 文件夹优先
          if (a.item_type === 'folder' && b.item_type !== 'folder') return -1
          if (a.item_type !== 'folder' && b.item_type === 'folder') return 1
          
          // 同类型按名称排序
          return a.file_name.localeCompare(b.file_name)
        })
      }
      
      sortItems(fileTree)
      
      console.log(`✅ 文件树构建完成，根级项目数量: ${fileTree.length}`)
      return { success: true, data: fileTree }
      
    } catch (error) {
      console.error('❌ 获取项目文件树失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 获取项目文件树结构（按文件夹表组织）
  async getProjectFileTreeByTables(projectId, projectName) {
    try {
      console.log(`🌳 获取项目 "${projectName}" 的文件树结构（按表组织）...`)
      
      const safeTableName = this.generateSafeTableName(projectName)
      
      // 获取所有相关的表（主项目表 + 文件夹表）
      const [allTables] = await pool.execute(`SHOW TABLES LIKE '${safeTableName}%'`)
      
      if (allTables.length === 0) {
        console.log(`⚠️ 项目相关表不存在，返回空树`)
        return { success: true, data: [] }
      }
      
      const fileTree = []
      
      // 先处理主项目表
      const mainTableName = safeTableName
      const [mainItems] = await pool.execute(`SELECT * FROM \`${mainTableName}\` ORDER BY file_name ASC`)
      
      // 处理主项目表中的项目项
      for (const item of mainItems) {
        if (item.item_type === 'folder') {
          // 这是一个文件夹，需要查找对应的文件夹表
          const folderTableName = `${safeTableName}__${item.file_name}`
          
          // 查找文件夹表
          let folderFiles = []
          try {
            const [files] = await pool.execute(`SELECT * FROM \`${folderTableName}\` ORDER BY file_name ASC`)
            folderFiles = files
          } catch (error) {
            console.warn(`⚠️ 文件夹表 "${folderTableName}" 不存在，创建空文件夹`)
            folderFiles = [] // 创建空文件夹
          }
          
          // 特殊处理：如果这是src文件夹，需要添加router和views子文件夹
          let processedChildren = await this.processFolderContents(folderFiles, safeTableName, `${safeTableName}__${item.file_name}`)
          
          if (item.file_name === 'src') {
            // 为src文件夹添加router和views子文件夹
            const additionalFolders = await this.addSrcSubFolders(safeTableName)
            processedChildren = [...processedChildren, ...additionalFolders]
          }
          
          // 创建文件夹节点
          const folderNode = {
            id: `folder_${item.file_name}`,
            file_path: `/${item.file_name}`,
            file_name: item.file_name,
            item_type: 'folder',
            file_type: null,
            file_size: 0,
            content: null,
            parent_path: null,
            depth: 0,
            child_count: processedChildren.length,
            file_count: processedChildren.length,
            folder_count: 0,
            last_modified: new Date().toISOString(),
            created_at: new Date().toISOString(),
            created_by: 'system',
            status: 'active',
            children: processedChildren
          }
          
          fileTree.push(folderNode)
          console.log(`✅ 文件夹 "${item.file_name}" 包含 ${processedChildren.length} 个项目`)
          
        } else {
          // 这是一个根级文件
          const fileNode = {
            ...item,
            children: []
          }
          fileTree.push(fileNode)
          console.log(`✅ 根级文件 "${item.file_name}"`)
        }
      }
      
      console.log(`✅ 文件树构建完成，共 ${fileTree.length} 个项目项`)
      return {
        success: true,
        data: fileTree
      }
      
    } catch (error) {
      console.error('❌ 获取项目文件树失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 为src文件夹添加router和views子文件夹
  async addSrcSubFolders(safeTableName) {
    const subFolders = []
    
    // 检查router子文件夹
    const routerTableName = `${safeTableName}__src__router`
    try {
      const [routerFiles] = await pool.execute(`SELECT * FROM \`${routerTableName}\` ORDER BY file_name ASC`)
      
      const routerFolder = {
        id: `folder_router`,
        file_path: `/src/router`,
        file_name: 'router',
        item_type: 'folder',
        file_type: null,
        file_size: 0,
        content: null,
        parent_path: '/src',
        depth: 1,
        child_count: routerFiles.length,
        file_count: routerFiles.length,
        folder_count: 0,
        last_modified: new Date().toISOString(),
        created_at: new Date().toISOString(),
        created_by: 'system',
        status: 'active',
        children: routerFiles.map(file => ({
          ...file,
          children: []
        }))
      }
      
      subFolders.push(routerFolder)
      console.log(`✅ 添加router子文件夹，包含 ${routerFiles.length} 个文件`)
      
    } catch (error) {
      console.warn(`⚠️ router子文件夹表 "${routerTableName}" 不存在`)
    }
    
    // 检查views子文件夹
    const viewsTableName = `${safeTableName}__src__views`
    try {
      const [viewsFiles] = await pool.execute(`SELECT * FROM \`${viewsTableName}\` ORDER BY file_name ASC`)
      
      const viewsFolder = {
        id: `folder_views`,
        file_path: `/src/views`,
        file_name: 'views',
        item_type: 'folder',
        file_type: null,
        file_size: 0,
        content: null,
        parent_path: '/src',
        depth: 1,
        child_count: viewsFiles.length,
        file_count: viewsFiles.length,
        folder_count: 0,
        last_modified: new Date().toISOString(),
        created_at: new Date().toISOString(),
        created_by: 'system',
        status: 'active',
        children: viewsFiles.map(file => ({
          ...file,
          children: []
        }))
      }
      
      subFolders.push(viewsFolder)
      console.log(`✅ 添加views子文件夹，包含 ${viewsFiles.length} 个文件`)
      
    } catch (error) {
      console.warn(`⚠️ views子文件夹表 "${viewsTableName}" 不存在`)
    }
    
    return subFolders
  }

  // 递归处理文件夹内容（包括子文件夹）
  async processFolderContents(folderFiles, safeTableName, currentPath) {
    const processedItems = []
    
    for (const file of folderFiles) {
      if (file.item_type === 'folder') {
        // 这是一个子文件夹，需要查找对应的子文件夹表
        const subFolderTableName = `${currentPath}__${file.file_name}`
        
        // 查找子文件夹表
        let subFolderFiles = []
        try {
          const [files] = await pool.execute(`SELECT * FROM \`${subFolderTableName}\` ORDER BY file_name ASC`)
          subFolderFiles = files
        } catch (error) {
          console.warn(`⚠️ 子文件夹表 "${subFolderTableName}" 不存在，跳过`)
          continue
        }
        
        // 递归处理子文件夹内容
        const processedSubChildren = await this.processFolderContents(subFolderFiles, safeTableName, subFolderTableName)
        
        // 创建子文件夹节点
        const subFolderNode = {
          id: `folder_${file.file_name}`,
          file_path: `/${file.file_name}`,
          file_name: file.file_name,
          item_type: 'folder',
          file_type: null,
          file_size: 0,
          content: null,
          parent_path: null,
          depth: 1,
          child_count: processedSubChildren.length,
          file_count: processedSubChildren.length,
          folder_count: 0,
          last_modified: new Date().toISOString(),
          created_at: new Date().toISOString(),
          created_by: 'system',
          status: 'active',
          children: processedSubChildren
        }
        
        processedItems.push(subFolderNode)
        console.log(`✅ 子文件夹 "${file.file_name}" 包含 ${processedSubChildren.length} 个项目`)
        
      } else {
        // 这是一个文件
        const fileNode = {
          ...file,
          children: []
        }
        processedItems.push(fileNode)
        console.log(`✅ 文件 "${file.file_name}"`)
      }
    }
    
    return processedItems
  }

  // 删除项目
  async deleteProject(projectId) {
    try {
      console.log(`🗑️ 开始删除项目: ${projectId}`);
      
      // 获取项目信息
      const projectResult = await this.getProject(projectId);
      if (!projectResult.success) {
        return { success: false, error: '项目不存在' };
      }
      
      const project = projectResult.data;
      const projectName = project.name;
      const safeTableName = this.generateSafeTableName(projectName);
      
      // 删除项目相关的所有表
      const [allTables] = await pool.execute(`SHOW TABLES LIKE '${safeTableName}%'`);
      
      for (const tableRow of allTables) {
        const tableName = Object.values(tableRow)[0];
        console.log(`🗑️ 删除表: ${tableName}`);
        await pool.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
      }
      
      // 删除项目成员关系
      await pool.execute('DELETE FROM project_members WHERE project_id = ?', [projectId]);
      
      // 删除项目记录
      await pool.execute('DELETE FROM projects WHERE id = ?', [projectId]);
      
      console.log(`✅ 项目 ${projectName} 删除成功`);
      return { success: true, message: '项目删除成功' };
      
    } catch (error) {
      console.error('❌ 删除项目失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 重新组织项目文件结构
  async reorganizeProjectStructure(projectId, projectName) {
    try {
      console.log(`📁 重新组织项目 "${projectName}" 的文件结构...`)
      
      const safeTableName = this.generateSafeTableName(projectName)
      
      // 检查主项目表是否存在
      const [tables] = await pool.execute(`SHOW TABLES LIKE '${safeTableName}'`)
      if (tables.length === 0) {
        return { success: false, error: '项目文件表不存在' }
      }
      
      // 获取所有现有文件
      const [existingFiles] = await pool.execute(`SELECT * FROM \`${safeTableName}\` WHERE status = 'active'`)
      
      // 定义文件夹结构
      const folderStructure = {
        'src': ['main.js', 'App.vue'],
        'router': ['index.js'],
        'components': ['Games.vue'],
        'public': ['index.html'],
        'config': ['vite.config.js', 'package.json']
      }
      
      // 创建文件夹
      for (const [folderName, files] of Object.entries(folderStructure)) {
        const folderPath = `/${folderName}`
        
        // 检查文件夹是否已存在
        const [existingFolder] = await pool.execute(
          `SELECT id FROM \`${safeTableName}\` WHERE file_path = ? AND item_type = 'folder'`,
          [folderPath]
        )
        
        if (existingFolder.length === 0) {
          // 创建文件夹
          await pool.execute(
            `INSERT INTO \`${safeTableName}\` (file_path, file_name, item_type, parent_path, depth, child_count, file_count, folder_count, last_modified, created_at, created_by, status) VALUES (?, ?, 'folder', null, 0, 0, 0, 0, NOW(), NOW(), 'system', 'active')`,
            [folderPath, folderName]
          )
          console.log(`✅ 创建文件夹: ${folderName}`)
        }
        
        // 移动文件到文件夹
        for (const fileName of files) {
          const existingFile = existingFiles.find(f => f.file_name === fileName)
          if (existingFile) {
            const newPath = `${folderPath}/${fileName}`
            const newDepth = 1
            
            // 更新文件路径和父路径
            await pool.execute(
              `UPDATE \`${safeTableName}\` SET file_path = ?, parent_path = ?, depth = ? WHERE id = ?`,
              [newPath, folderPath, newDepth, existingFile.id]
            )
            console.log(`✅ 移动文件 ${fileName} 到 ${folderName}/`)
          }
        }
      }
      
      // 更新文件夹的子项计数
      for (const folderName of Object.keys(folderStructure)) {
        const folderPath = `/${folderName}`
        const [childCount] = await pool.execute(
          `SELECT COUNT(*) as count FROM \`${safeTableName}\` WHERE parent_path = ? AND status = 'active'`,
          [folderPath]
        )
        
        await pool.execute(
          `UPDATE \`${safeTableName}\` SET child_count = ? WHERE file_path = ? AND item_type = 'folder'`,
          [childCount[0].count, folderPath]
        )
      }
      
      console.log(`✅ 项目文件结构重组完成`)
      return { success: true, message: '文件结构重组成功' }
      
    } catch (error) {
      console.error('❌ 重组项目文件结构失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 构建文件树结构
  buildFileTree(items) {
    const tree = []
    const itemMap = new Map()
    
    // 创建项目项映射
    items.forEach(item => {
      itemMap.set(item.file_path, {
        ...item,
        children: []
      })
    })
    
    // 构建树结构
    items.forEach(item => {
      const treeItem = itemMap.get(item.file_path)
      
      // 检查是否有父目录
      const hasParent = item.parent_path && 
                       item.parent_path.trim() !== '' && 
                       item.parent_path !== '/' &&
                       itemMap.has(item.parent_path)
      
      if (hasParent) {
        // 有父目录，添加到父目录的children中
        const parent = itemMap.get(item.parent_path)
        if (parent) {
          parent.children.push(treeItem)
        } else {
          // 父目录不存在，作为根级项目
          tree.push(treeItem)
        }
      } else {
        // 根目录项目，添加到树根
        tree.push(treeItem)
      }
    })
    
    // 按类型和名称排序
    const sortItems = (items) => {
      return items.sort((a, b) => {
        // 文件夹优先
        if (a.item_type === 'folder' && b.item_type !== 'folder') return -1
        if (a.item_type !== 'folder' && b.item_type === 'folder') return 1
        
        // 同类型按名称排序
        return a.file_name.localeCompare(b.file_name)
      })
    }
    
    // 递归排序所有层级
    const sortTree = (items) => {
      sortItems(items)
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          sortTree(item.children)
        }
      })
    }
    
    sortTree(tree)
    return tree
  }
  
  // 创建文件夹
  async createFolder(projectId, projectName, folderData) {
    try {
      console.log(`📁 在项目 "${projectName}" 中创建文件夹...`)
      
      // 生成文件路径
      const filePath = folderData.parent_path 
        ? `${folderData.parent_path}/${folderData.file_name}`
        : folderData.file_name
      
      const itemData = {
        file_path: filePath,
        file_name: folderData.file_name,
        item_type: 'folder',
        parent_path: folderData.parent_path || null,
        depth: folderData.parent_path ? folderData.parent_path.split('/').length : 0,
        child_count: 0,
        file_count: 0,
        folder_count: 0,
        created_by: folderData.created_by || 'system'
      }
      
      const result = await this.saveItemToProject(projectId, projectName, itemData)
      
      if (result.success) {
        // 为文件夹创建独立的数据表
        const folderTableResult = await this.createFolderDataTable(projectId, projectName, filePath, folderData.file_name)
        if (folderTableResult.success) {
          console.log(`✅ 文件夹 "${folderData.file_name}" 的独立数据表创建成功: ${folderTableResult.tableName}`)
        } else {
          console.warn(`⚠️ 文件夹 "${folderData.file_name}" 的独立数据表创建失败:`, folderTableResult.error)
        }
        
        // 记录创建文件夹的日志
        await this.logProjectActivity(projectId, folderData.created_by || 'system', 'folder_created', {
          folderPath: filePath,
          folderName: folderData.file_name,
          parentPath: folderData.parent_path,
          folderTableName: folderTableResult.tableName
        })
      }
      
      return result
    } catch (error) {
      console.error('❌ 创建文件夹失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  // 创建文件
  async createFile(projectId, projectName, fileData) {
    try {
      console.log(`📄 在项目 "${projectName}" 中创建文件...`)
      
      // 修复路径重复问题：根据存储位置决定文件路径
      let filePath;
      let actualFileName = fileData.file_name;
      
      // 如果文件名包含路径，提取实际文件名
      if (fileData.file_name.includes('/')) {
        const pathParts = fileData.file_name.split('/');
        actualFileName = pathParts.pop(); // 最后一部分是实际文件名
        const extractedParentPath = pathParts.join('/');
        
        console.log(`🔍 路径解析调试信息:`);
        console.log(`  - 原始file_name: ${fileData.file_name}`);
        console.log(`  - pathParts: ${JSON.stringify(pathParts)}`);
        console.log(`  - actualFileName: ${actualFileName}`);
        console.log(`  - extractedParentPath: ${extractedParentPath}`);
        console.log(`  - 传入的parent_path: ${fileData.parent_path}`);
        
        // 如果提取的父路径与传入的parent_path不同，使用提取的路径
        if (extractedParentPath !== fileData.parent_path) {
          fileData.parent_path = extractedParentPath;
        }
      }
      
      let folderTableName = null;
      if (fileData.parent_path) {
        // 如果有父路径，检查是否会存储到文件夹表中
        folderTableName = this.getFolderTableName(projectName, fileData.parent_path);
        if (folderTableName) {
          // 存储到文件夹表时，文件路径只使用实际文件名，不包含父路径
          filePath = `/${actualFileName}`;
          console.log(`📁 文件将存储到文件夹表 ${folderTableName}`);
          console.log(`📁 父路径: ${fileData.parent_path}`);
          console.log(`📁 文件路径: ${filePath}`);
          console.log(`📁 文件名: ${actualFileName}`);
        } else {
          // 存储到主表时，使用完整路径
          filePath = `/${fileData.parent_path}/${actualFileName}`;
        }
      } else {
        // 没有父路径，直接使用文件名
        filePath = `/${actualFileName}`;
      }
      
      const itemData = {
        file_path: filePath,
        file_name: actualFileName, // 使用实际文件名，不包含路径
        item_type: 'file',
        file_type: fileData.file_type,
        file_size: fileData.file_size || 0,
        content: fileData.content || null,
        parent_path: fileData.parent_path, // 保持原始父路径，用于创建表
        depth: fileData.parent_path ? fileData.parent_path.split('/').length : 0,
        created_by: fileData.created_by || 'system'
      }
      
      // 如果有父路径，检查是否应该存储到文件夹数据表中
      if (fileData.parent_path && folderTableName) {
          console.log(`📁 文件将存储到文件夹数据表: ${folderTableName}`)
          const result = await this.saveItemToFolderTable(projectId, folderTableName, itemData, projectName)
          
          if (result.success) {
            // 记录创建文件的日志
            await this.logProjectActivity(projectId, fileData.created_by || 'system', 'file_created', {
              filePath: filePath,
              fileName: fileData.file_name,
              fileType: fileData.file_type,
              parentPath: fileData.parent_path,
              folderTableName: folderTableName
            })
          }
          
          return result
      }
      
      // 如果没有父路径或找不到文件夹表，存储到主项目表
      const result = await this.saveItemToProject(projectId, projectName, itemData)
      
      if (result.success) {
        // 记录创建文件的日志
        await this.logProjectActivity(projectId, fileData.created_by || 'system', 'file_created', {
          filePath: filePath,
          fileName: fileData.file_name,
          fileType: fileData.file_type,
          parentPath: fileData.parent_path
        })
      }
      
      return result
    } catch (error) {
      console.error('❌ 创建文件失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  // 删除项目项
  async deleteFile(projectId, fileName, filePath) {
    try {
      console.log(`🗑️ 删除文件: ${fileName} (${filePath})`)
      
      // 获取项目信息
      const project = await this.getProject(projectId)
      if (!project.success) {
        return { success: false, error: '项目不存在' }
      }
      
      const projectName = project.data.name
      const safeTableName = this.generateSafeTableName(projectName)
      
      // 首先检查文件是否已经被删除
      const [existingItems] = await pool.execute(
        `SELECT * FROM \`${safeTableName}\` WHERE file_name = ? AND file_path = ?`,
        [fileName, filePath]
      )
      
      if (existingItems.length > 0) {
        const existingItem = existingItems[0]
        if (existingItem.status === 'deleted') {
          console.log(`⚠️ 文件已经被删除: ${fileName}`)
          return { success: false, error: '文件已经被删除' }
        }
      }
      
      // 然后尝试从主项目表删除
      const [mainItems] = await pool.execute(
        `SELECT * FROM \`${safeTableName}\` WHERE file_name = ? AND file_path = ? AND status = 'active'`,
        [fileName, filePath]
      )
      
      if (mainItems.length > 0) {
        // 软删除：使用更安全的方式避免唯一约束冲突
        const deletedPath = `${filePath}-deleted-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        await pool.execute(
          `UPDATE \`${safeTableName}\` SET status = 'deleted', file_path = ?, last_modified = CURRENT_TIMESTAMP WHERE file_name = ? AND file_path = ?`,
          [deletedPath, fileName, filePath]
        )
        console.log(`✅ 从主项目表删除文件成功: ${fileName}`)
        return { success: true, message: '文件删除成功' }
      }
      
      // 如果主项目表没有，尝试从文件夹表删除
      const pathParts = filePath.split('/').filter(part => part.trim() !== '')
      if (pathParts.length > 0) {
        const folderTableName = this.getFolderTableName(projectName, pathParts.slice(0, -1).join('/'))
        if (folderTableName) {
          const [folderTables] = await pool.execute(`SHOW TABLES LIKE '${folderTableName}'`)
          if (folderTables.length > 0) {
            // 在文件夹表中，file_path通常只是文件名，所以只使用fileName查找
            const [existingFolderItems] = await pool.execute(
              `SELECT * FROM \`${folderTableName}\` WHERE file_name = ?`,
              [fileName]
            )
            
            if (existingFolderItems.length > 0) {
              const existingItem = existingFolderItems[0]
              if (existingItem.status === 'deleted') {
                console.log(`⚠️ 文件在文件夹表中已经被删除: ${fileName}`)
                return { success: false, error: '文件已经被删除' }
              }
            }
            
            const [folderItems] = await pool.execute(
              `SELECT * FROM \`${folderTableName}\` WHERE file_name = ? AND status = 'active'`,
              [fileName]
            )
            
            if (folderItems.length > 0) {
              // 软删除：使用更安全的方式避免唯一约束冲突
              const deletedPath = `${filePath}-deleted-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
              await pool.execute(
                `UPDATE \`${folderTableName}\` SET status = 'deleted', file_path = ?, last_modified = CURRENT_TIMESTAMP WHERE file_name = ?`,
                [deletedPath, fileName]
              )
              console.log(`✅ 从文件夹表删除文件成功: ${fileName}`)
              return { success: true, message: '文件删除成功' }
            }
          }
        }
      }
      
      return { success: false, error: '文件不存在' }
    } catch (error) {
      console.error('❌ 删除文件失败:', error)
      return { success: false, error: error.message }
    }
  }

  async deleteItem(projectId, projectName, itemPath) {
    try {
      console.log(`🗑️ 在项目 "${projectName}" 中删除项目项: ${itemPath}`)
      
      const safeTableName = this.generateSafeTableName(projectName)
      
      // 获取所有相关的表（包括子表）
      const [allTables] = await pool.execute(`SHOW TABLES LIKE '${safeTableName}%'`)
      console.log(`📊 找到 ${allTables.length} 个相关表`)
      
      if (allTables.length === 0) {
        return {
          success: false,
          error: '项目文件表不存在'
        }
      }
      
      let foundItem = null
      let foundTableName = null
      
      // 遍历所有表查找要删除的项目项
      for (const tableRow of allTables) {
        const tableName = Object.values(tableRow)[0]
        console.log(`🔍 在表 ${tableName} 中查找: ${itemPath}`)
        
        // 获取表结构
        const [columns] = await pool.execute(`DESCRIBE \`${tableName}\``)
        const columnNames = columns.map(col => col.Field)
        
        // 构建查询，只使用存在的列
        let query = `SELECT * FROM \`${tableName}\` WHERE file_path = ?`
        let params = [itemPath]
        
        // 只查找active状态的文件
        if (columnNames.includes('status')) {
          query += ` AND status = 'active'`
        }
        
        console.log(`🔍 执行查询: ${query} 参数: [${params.join(', ')}]`)
        const [items] = await pool.execute(query, params)
        
        if (items.length > 0) {
          foundItem = items[0]
          foundTableName = tableName
          console.log(`✅ 在表 ${tableName} 中找到项目项: ${foundItem.file_name}`)
          break
        }
      }
      
      if (!foundItem) {
        // 检查是否在任何表中已经被删除
        let alreadyDeleted = false
        for (const tableRow of allTables) {
          const tableName = Object.values(tableRow)[0]
          
          const [columns] = await pool.execute(`DESCRIBE \`${tableName}\``)
          const columnNames = columns.map(col => col.Field)
          
          let query = `SELECT * FROM \`${tableName}\` WHERE file_path = ?`
          let params = [itemPath]
          
          if (columnNames.includes('status')) {
            query += ` AND status = 'deleted'`
          }
          
          const [deletedItems] = await pool.execute(query, params)
          
          if (deletedItems.length > 0) {
            alreadyDeleted = true
            break
          }
        }
        
        if (alreadyDeleted) {
          return {
            success: false,
            error: '文件已经被删除'
          }
        } else {
          return {
            success: false,
            error: '项目项不存在'
          }
        }
      }
      
      // 如果是文件夹，检查是否有子项目
      if (foundItem.item_type === 'folder') {
        let hasChildren = false
        
        for (const tableRow of allTables) {
          const tableName = Object.values(tableRow)[0]
          
          const [columns] = await pool.execute(`DESCRIBE \`${tableName}\``)
          const columnNames = columns.map(col => col.Field)
          
          let query = `SELECT COUNT(*) as count FROM \`${tableName}\` WHERE parent_path = ?`
          let params = [itemPath]
          
          if (columnNames.includes('status')) {
            query += ` AND status = 'active'`
          }
          
          const [children] = await pool.execute(query, params)
          
          if (children[0].count > 0) {
            hasChildren = true
            break
          }
        }
        
        if (hasChildren) {
          return {
            success: false,
            error: '文件夹不为空，无法删除'
          }
        }
      }
      
      // 软删除（标记为deleted）
      await pool.execute(
        `UPDATE \`${foundTableName}\` SET status = 'deleted', last_modified = CURRENT_TIMESTAMP WHERE file_path = ?`,
        [itemPath]
      )
      
      // 更新父文件夹的计数
      if (foundItem.parent_path) {
        await this.updateParentFolderCounts(foundTableName, foundItem.parent_path)
      }
      
      // 记录删除日志
      await this.logProjectActivity(projectId, 'system', 'item_deleted', {
        itemPath: itemPath,
        itemName: foundItem.file_name,
        itemType: foundItem.item_type,
        parentPath: foundItem.parent_path
      })
      
      console.log(`✅ 项目项 "${foundItem.file_name}" 删除成功`)
      
      return {
        success: true,
        message: '项目项删除成功'
      }
    } catch (error) {
      console.error('❌ 删除项目项失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 更新项目设置
  async updateProjectSettings(projectId, settings) {
    try {
      console.log(`⚙️ 更新项目 "${projectId}" 的设置...`)
      console.log('📊 新设置:', settings)
      
      // 检查项目是否存在
      const [projects] = await pool.execute(
        'SELECT * FROM projects WHERE id = ?',
        [projectId]
      )
      
      if (projects.length === 0) {
        return {
          success: false,
          error: '项目不存在'
        }
      }
      
      const project = projects[0]
      
      // 检查当前成员数量
      const [memberCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM project_members WHERE project_id = ? AND status = "active"',
        [projectId]
      )
      
      const currentMemberCount = memberCount[0].count
      
      // 如果新的最大成员数小于当前成员数，拒绝更新
      if (settings.maxMembers < currentMemberCount) {
        return {
          success: false,
          error: `当前成员数 (${currentMemberCount}) 已超过新的最大成员数限制 (${settings.maxMembers})`
        }
      }
      
      // 更新项目设置
      await pool.execute(
        'UPDATE projects SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [JSON.stringify(settings), projectId]
      )
      
      // 记录设置更新日志
      await this.logProjectActivity(projectId, 'system', 'settings_updated', {
        oldSettings: project.settings,
        newSettings: settings,
        updatedBy: 'system'
      })
      
      // 获取更新后的项目信息
      const [updatedProjects] = await pool.execute(
        'SELECT * FROM projects WHERE id = ?',
        [projectId]
      )
      
      const updatedProject = updatedProjects[0]
      try {
        updatedProject.settings = JSON.parse(updatedProject.settings)
      } catch (error) {
        console.warn('⚠️ 解析settings字段失败，使用默认值:', error.message)
        updatedProject.settings = settings
      }
      
      console.log('✅ 项目设置更新成功')
      
      return {
        success: true,
        data: updatedProject,
        message: '项目设置更新成功'
      }
    } catch (error) {
      console.error('❌ 更新项目设置失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 更新文件内容
  // 获取项目的所有文件夹数据表
  async getFolderTables(projectName) {
    try {
      const safeTableName = this.generateSafeTableName(projectName)
      const [allTables] = await pool.execute(`SHOW TABLES LIKE '${safeTableName}__%'`)
      
      const folderTables = allTables.map(tableRow => {
        // 获取表名（MySQL返回的对象键名是动态的）
        return Object.values(tableRow)[0]
      })
      
      console.log(`📁 找到 ${folderTables.length} 个文件夹数据表:`, folderTables)
      return folderTables
    } catch (error) {
      console.error('❌ 获取文件夹数据表失败:', error)
      return []
    }
  }

  async updateFileContent(projectId, projectName, filePath, newContent) {
    try {
      console.log(`✏️ 更新文件内容: ${filePath}`)
      console.log(`📄 新内容长度: ${newContent ? newContent.length : 0}`)
      
      // 获取项目信息
      const project = await this.getProject(projectId)
      if (!project.success) {
        return { success: false, error: '项目不存在' }
      }
      
      const safeTableName = this.generateSafeTableName(projectName)
      
      // 首先尝试从主项目表更新
      const [mainItems] = await pool.execute(
        `SELECT * FROM \`${safeTableName}\` WHERE file_path = ? AND status = 'active'`,
        [filePath]
      )
      
      if (mainItems.length > 0) {
        // 更新主项目表中的文件
        await pool.execute(
          `UPDATE \`${safeTableName}\` SET content = ?, file_size = ?, last_modified = CURRENT_TIMESTAMP WHERE file_path = ? AND status = 'active'`,
          [newContent, newContent ? newContent.length : 0, filePath]
        )
        
        console.log(`✅ 文件内容更新成功 (主表): ${filePath}`)
        
        // 记录更新操作
        await this.logProjectActivity(projectId, 1, 'file_modified', {
          filePath: filePath,
          fileName: mainItems[0].file_name,
          operationType: 'update_content',
          newSize: newContent ? newContent.length : 0
        })
        
        return {
          success: true,
          message: '文件内容更新成功'
        }
      }
      
      // 如果主项目表中没有，尝试从文件夹数据表中查找
      const folderTables = await this.getFolderTables(projectName)
      
      for (const tableName of folderTables) {
        const [folderItems] = await pool.execute(
          `SELECT * FROM \`${tableName}\` WHERE file_path = ? AND status = 'active'`,
          [filePath]
        )
        
        if (folderItems.length > 0) {
          // 更新文件夹数据表中的文件
          await pool.execute(
            `UPDATE \`${tableName}\` SET content = ?, file_size = ?, last_modified = CURRENT_TIMESTAMP WHERE file_path = ? AND status = 'active'`,
            [newContent, newContent ? newContent.length : 0, filePath]
          )
          
          console.log(`✅ 文件内容更新成功 (文件夹表): ${filePath}`)
          
          // 记录更新操作
          await this.logProjectActivity(projectId, 1, 'file_modified', {
            filePath: filePath,
            fileName: folderItems[0].file_name,
            operationType: 'update_content',
            newSize: newContent ? newContent.length : 0,
            folderTableName: tableName
          })
          
          return {
            success: true,
            message: '文件内容更新成功'
          }
        }
      }
      
      // 如果都没找到
      console.log(`❌ 文件未找到: ${filePath}`)
      return {
        success: false,
        error: '文件未找到'
      }
      
    } catch (error) {
      console.error('❌ 更新文件内容失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 获取项目文件列表 - 简化版本（兼容旧表结构）
  async getProjectFilesSimple(projectId, projectName, parentPath = null) {
    try {
      console.log(`📋 获取项目 "${projectName}" 的项目项列表...`)
      
      const safeTableName = this.generateSafeTableName(projectName)
      console.log(`🔍 查询表: ${safeTableName}`)
      
      // 获取所有相关的表（包括子表）
      const [allTables] = await pool.execute(`SHOW TABLES LIKE '${safeTableName}%'`)
      console.log(`📊 找到 ${allTables.length} 个相关表`)
      
      if (allTables.length === 0) {
        console.log(`⚠️ 没有找到相关表`)
        return {
          success: true,
          data: [],
          tableName: safeTableName
        }
      }
      
      const allItems = []
      
      // 遍历所有表获取文件
      for (const tableRow of allTables) {
        const tableName = Object.values(tableRow)[0]
        console.log(`🔍 查询子表: ${tableName}`)
        
        // 获取表结构
        const [columns] = await pool.execute(`DESCRIBE \`${tableName}\``)
        const columnNames = columns.map(col => col.Field)
        
        // 构建查询，只使用存在的列
        let query = `SELECT * FROM \`${tableName}\``
        let params = []
        let whereConditions = []
        
        // 过滤已删除的文件
        if (columnNames.includes('status')) {
          whereConditions.push(`status = 'active'`)
        }
        
        if (parentPath && columnNames.includes('parent_path')) {
          whereConditions.push(`parent_path = ?`)
          params.push(parentPath)
        } else if (parentPath === null && columnNames.includes('parent_path')) {
          whereConditions.push(`(parent_path IS NULL OR parent_path = '')`)
        }
        
        if (whereConditions.length > 0) {
          query += ` WHERE ${whereConditions.join(' AND ')}`
        }
        
        // 根据实际存在的列进行排序
        if (columnNames.includes('file_name')) {
          query += ` ORDER BY file_name ASC`
        } else if (columnNames.includes('name')) {
          query += ` ORDER BY name ASC`
        } else if (columnNames.includes('id')) {
          query += ` ORDER BY id ASC`
        }
        
        console.log(`🔍 执行查询: ${query} 参数: [${params.join(', ')}]`)
        const [items] = await pool.execute(query, params)
        
        console.log(`📄 从表 ${tableName} 获取到 ${items.length} 个项目项`)
        allItems.push(...items)
      }
      
      console.log(`✅ 总共获取到 ${allItems.length} 个项目项`)
      allItems.forEach(item => {
        const type = item.item_type === 'folder' ? '📁' : '📄';
        console.log(`  ${type} ${item.file_name} (${item.file_path || 'N/A'})`);
      })
      
      return {
        success: true,
        data: allItems,
        tableName: safeTableName
      }
    } catch (error) {
      console.error('❌ 获取项目文件失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 清理项目中所有已删除的文件记录
  async cleanupDeletedFiles(projectId, projectName) {
    try {
      console.log(`🧹 清理项目 "${projectName}" 中的已删除文件记录...`)
      
      const safeTableName = this.generateSafeTableName(projectName)
      
      // 获取所有相关的表（包括子表）
      const [allTables] = await pool.execute(`SHOW TABLES LIKE '${safeTableName}%'`)
      console.log(`📊 找到 ${allTables.length} 个相关表需要清理`)
      
      if (allTables.length === 0) {
        console.log(`⚠️ 没有找到相关表`)
        return {
          success: true,
          message: '没有找到需要清理的表',
          deletedCount: 0
        }
      }
      
      let totalDeletedCount = 0
      
      // 遍历所有表清理已删除的记录
      for (const tableRow of allTables) {
        const tableName = Object.values(tableRow)[0]
        console.log(`🔍 清理表: ${tableName}`)
        
        // 获取表结构
        const [columns] = await pool.execute(`DESCRIBE \`${tableName}\``)
        const columnNames = columns.map(col => col.Field)
        
        // 检查是否有status列
        if (!columnNames.includes('status')) {
          console.log(`⚠️ 表 ${tableName} 没有status列，跳过清理`)
          continue
        }
        
        // 先统计要删除的记录数
        const [countResult] = await pool.execute(
          `SELECT COUNT(*) as count FROM \`${tableName}\` WHERE status = 'deleted'`
        )
        const deletedCount = countResult[0].count
        
        if (deletedCount > 0) {
          // 删除已删除状态的记录
          await pool.execute(
            `DELETE FROM \`${tableName}\` WHERE status = 'deleted'`
          )
          
          console.log(`✅ 从表 ${tableName} 清理了 ${deletedCount} 条已删除记录`)
          totalDeletedCount += deletedCount
        } else {
          console.log(`📄 表 ${tableName} 没有已删除的记录`)
        }
      }
      
      console.log(`🎉 清理完成！总共清理了 ${totalDeletedCount} 条已删除记录`)
      
      return {
        success: true,
        message: `成功清理了 ${totalDeletedCount} 条已删除记录`,
        deletedCount: totalDeletedCount
      }
    } catch (error) {
      console.error('❌ 清理已删除文件失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

module.exports = new ProjectService()
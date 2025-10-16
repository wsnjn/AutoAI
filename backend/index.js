const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { testConnection, createDatabase, initDatabase, pool } = require('./config/database');
const folderService = require('./services/folderService');
const aiService = require('./services/aiService');
const fileWatcher = require('./services/fileWatcher');
const projectService = require('./services/projectService');
const projectTypeService = require('./services/projectTypeService');
const userService = require('./services/userService');

const app = express();
const port = 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 获取文件夹结构的函数
function getFolderStructure(folderPath, maxDepth = 3, currentDepth = 0) {
  try {
    console.log(`📁 正在扫描文件夹: ${folderPath} (深度: ${currentDepth})`);
    
    const stats = fs.statSync(folderPath);
    if (!stats.isDirectory()) {
      console.log(`❌ 路径不是文件夹: ${folderPath}`);
      return null;
    }

    const structure = {
      name: path.basename(folderPath),
      path: folderPath,
      type: 'directory',
      size: 0,
      children: [],
      fileCount: 0,
      folderCount: 0,
      lastModified: stats.mtime
    };

    const items = fs.readdirSync(folderPath);
    console.log(`📋 文件夹 ${folderPath} 包含 ${items.length} 个项目`);

    for (const item of items) {
      const itemPath = path.join(folderPath, item);
      
      try {
        const itemStats = fs.statSync(itemPath);
        
        if (itemStats.isDirectory()) {
          structure.folderCount++;
          
          if (currentDepth < maxDepth) {
            const childStructure = getFolderStructure(itemPath, maxDepth, currentDepth + 1);
            if (childStructure) {
              structure.children.push(childStructure);
            }
          } else {
            structure.children.push({
              name: item,
              path: itemPath,
              type: 'directory',
              size: 0,
              children: [],
              fileCount: 0,
              folderCount: 0,
              lastModified: itemStats.mtime,
              note: '已达到最大扫描深度'
            });
          }
        } else {
          structure.fileCount++;
          structure.children.push({
            name: item,
            path: itemPath,
            type: 'file',
            size: itemStats.size,
            lastModified: itemStats.mtime,
            extension: path.extname(item)
          });
        }
      } catch (error) {
        console.log(`⚠️ 无法访问项目: ${itemPath} - ${error.message}`);
        structure.children.push({
          name: item,
          path: itemPath,
          type: 'unknown',
          error: error.message
        });
      }
    }

    // 计算文件夹总大小
    structure.size = calculateFolderSize(structure);
    console.log(`✅ 文件夹 ${folderPath} 扫描完成 - 文件: ${structure.fileCount}, 文件夹: ${structure.folderCount}, 大小: ${formatBytes(structure.size)}`);
    
    return structure;
  } catch (error) {
    console.error(`❌ 扫描文件夹失败: ${folderPath} - ${error.message}`);
    return {
      name: path.basename(folderPath),
      path: folderPath,
      type: 'directory',
      error: error.message
    };
  }
}

// 计算文件夹大小的函数
function calculateFolderSize(structure) {
  let totalSize = 0;
  
  for (const child of structure.children) {
    if (child.type === 'file') {
      totalSize += child.size || 0;
    } else if (child.type === 'directory') {
      totalSize += calculateFolderSize(child);
    }
  }
  
  return totalSize;
}

// 格式化字节大小的函数
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 示例API路由
app.get('/api/message', (req, res) => {
  res.json({ message: '你好，来自后端服务器的消息！' });
});

app.post('/api/data', (req, res) => {
  const { name } = req.body;
  res.json({ message: `收到数据: ${name}` });
});

// 新的文件夹处理API
app.post('/api/folder-info', async (req, res) => {
  console.log('\n🚀 ===== 收到文件夹信息请求 =====');
  console.log(`📅 时间: ${new Date().toLocaleString('zh-CN')}`);
  
  const { folderPath, folderStructure } = req.body;
  
  console.log(`📂 接收到的文件夹路径: ${folderPath}`);
  console.log(`📊 接收到的文件夹结构数据大小: ${JSON.stringify(folderStructure).length} 字符`);
  
  if (!folderPath) {
    console.log('❌ 错误: 未提供文件夹路径');
    return res.status(400).json({
      success: false,
      error: '未提供文件夹路径'
    });
  }

  try {
    console.log('\n🔍 ===== 开始分析文件夹结构 =====');
    
    // 使用前端发送的文件夹结构数据，如果没有则尝试扫描文件系统
    let serverStructure;
    if (folderStructure && folderStructure.children && Array.isArray(folderStructure.children)) {
      serverStructure = folderStructure;
      console.log('✅ 使用前端发送的文件夹结构数据');
    } else {
      console.log('⚠️ 前端数据无效，尝试扫描文件系统');
      serverStructure = getFolderStructure(folderPath);
    }
    
    console.log('\n📈 ===== 文件夹统计信息 =====');
    console.log(`📁 文件夹名称: ${serverStructure.name || 'Unknown'}`);
    console.log(`📍 完整路径: ${serverStructure.path || folderPath}`);
    console.log(`📄 文件数量: ${serverStructure.fileCount || 0}`);
    console.log(`📂 子文件夹数量: ${serverStructure.folderCount || 0}`);
    console.log(`💾 总大小: ${formatBytes(serverStructure.size || 0)}`);
    console.log(`🕒 最后修改时间: ${serverStructure.lastModified ? new Date(serverStructure.lastModified).toLocaleString('zh-CN') : 'Unknown'}`);
    
    // 分析文件类型分布
    const fileExtensions = {};
    function analyzeFileTypes(structure) {
      if (!structure || !structure.children || !Array.isArray(structure.children)) {
        return;
      }
      
      for (const child of structure.children) {
        if (child.type === 'file' && child.extension) {
          fileExtensions[child.extension] = (fileExtensions[child.extension] || 0) + 1;
        } else if (child.type === 'directory') {
          analyzeFileTypes(child);
        }
      }
    }
    analyzeFileTypes(serverStructure);
    
    console.log('\n📋 ===== 文件类型分布 =====');
    Object.entries(fileExtensions)
      .sort(([,a], [,b]) => b - a)
      .forEach(([ext, count]) => {
        console.log(`${ext}: ${count} 个文件`);
      });
    
    console.log('\n💾 ===== 开始保存到数据库 =====');
    
    // 保存文件夹结构到数据库（使用新的动态表结构）
    const saveResult = await folderService.saveFolderStructure(folderPath, serverStructure);
    
    // 创建处理日志
    const logId = await folderService.createProcessingLog(
      saveResult.folderId, 
      'folder_analysis', 
      '文件夹分析完成', 
      {
        tableName: saveResult.tableName,
        totalFiles: serverStructure.fileCount,
        totalFolders: serverStructure.folderCount,
        totalSize: formatBytes(serverStructure.size),
        fileTypes: fileExtensions
      }
    );
    
    // 更新日志状态为完成
    await folderService.updateProcessingLog(
      logId, 
      'completed', 
      '文件夹分析处理完成', 
      { processedAt: new Date().toISOString() }
    );
    
    console.log('\n✅ ===== 处理完成 =====');
    console.log(`📊 创建的表名: ${saveResult.tableName}`);
    console.log(`📝 处理日志ID: ${logId}`);
    
    // 返回处理结果
    res.json({
      success: true,
      message: '文件夹信息处理成功',
      data: {
        folderPath,
        serverStructure,
        statistics: {
          totalFiles: serverStructure.fileCount,
          totalFolders: serverStructure.folderCount,
          totalSize: formatBytes(serverStructure.size),
          fileTypes: fileExtensions,
          lastModified: serverStructure.lastModified
        },
        database: {
          tableName: saveResult.tableName,
          folderId: saveResult.folderId,
          logId
        },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ 处理文件夹信息时发生错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取文件夹结构API
app.get('/api/folder-structure', async (req, res) => {
  const folderPath = req.query.path;
  
  if (!folderPath) {
    return res.status(400).json({
      success: false,
      error: '缺少路径参数'
    });
  }
  
  console.log(`\n🔍 请求获取文件夹结构: ${folderPath}`);
  
  try {
    // 从数据库获取文件夹结构
    const result = await folderService.getFolderStructure(folderPath);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: '文件夹结构不存在'
      });
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ 获取文件夹结构失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取所有文件夹列表
app.get('/api/folders', async (req, res) => {
  try {
    console.log('\n📋 请求获取所有文件夹列表');
    
    const folders = await folderService.getAllFolders();
    
    res.json({
      success: true,
      data: folders
    });
  } catch (error) {
    console.error('❌ 获取文件夹列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 删除文件夹
app.delete('/api/folder', async (req, res) => {
  try {
    const { folderPath } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({
        success: false,
        error: '缺少文件夹路径'
      });
    }
    
    console.log(`\n🗑️ 请求删除文件夹: ${folderPath}`);
    
    await folderService.deleteFolder(folderPath);
    
    res.json({
      success: true,
      message: '文件夹删除成功'
    });
  } catch (error) {
    console.error('❌ 删除文件夹失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取数据库中的文件夹信息
app.get('/api/folder', async (req, res) => {
  try {
    const folderPath = req.query.path;
    
    if (!folderPath) {
      return res.status(400).json({
        success: false,
        error: '缺少路径参数'
      });
    }
    
    console.log(`\n📊 请求获取数据库中的文件夹信息: ${folderPath}`);
    
    const folderInfo = await folderService.getFolderInfo(folderPath);
    
    if (!folderInfo) {
      return res.status(404).json({
        success: false,
        error: '文件夹信息不存在'
      });
    }
    
    // 获取文件详情
    const files = await folderService.getFolderFiles(folderInfo.id);
    
    // 获取处理日志
    const logs = await folderService.getProcessingLogs(folderInfo.id);
    
    res.json({
      success: true,
      data: {
        folderInfo,
        files,
        logs
      }
    });
  } catch (error) {
    console.error('❌ 获取文件夹信息失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取系统统计信息
app.get('/api/statistics', async (req, res) => {
  try {
    console.log('\n📈 请求获取系统统计信息');
    
    const statistics = await folderService.getStatistics();
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('❌ 获取统计信息失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 搜索相关接口
app.get('/api/search', async (req, res) => {
  try {
    const { query, userId } = req.query
    console.log(`🔍 搜索请求: "${query}" (用户: ${userId})`)
    
    if (!query || !query.trim()) {
      return res.json({
        success: true,
        data: []
      })
    }
    
    const searchResults = []
    const searchTerm = `%${query.trim()}%`
    
    // 搜索项目
    try {
      const [projects] = await pool.execute(
        `SELECT id, name, description, type, created_by, created_at 
         FROM projects 
         WHERE (name LIKE ? OR description LIKE ?) 
         AND status = 'active' 
         ORDER BY created_at DESC 
         LIMIT 10`,
        [searchTerm, searchTerm]
      )
      
      for (const project of projects) {
        searchResults.push({
          id: project.id,
          type: 'project',
          title: project.name,
          description: project.description || '暂无描述',
          icon: '📁',
          path: `/main-app/${project.id}`,
          data: project
        })
      }
      
      console.log(`📁 找到 ${projects.length} 个匹配的项目`)
    } catch (error) {
      console.error('❌ 搜索项目失败:', error)
    }
    
    // 搜索AI对话历史
    try {
      const [chats] = await pool.execute(
        `SELECT id, user_message, ai_response, created_at 
         FROM chathistory 
         WHERE (user_message LIKE ? OR ai_response LIKE ?) 
         AND user_id = ? 
         ORDER BY created_at DESC 
         LIMIT 5`,
        [searchTerm, searchTerm, userId]
      )
      
      for (const chat of chats) {
        searchResults.push({
          id: chat.id,
          type: 'ai_chat',
          title: chat.user_message.substring(0, 50) + (chat.user_message.length > 50 ? '...' : ''),
          description: chat.ai_response.substring(0, 100) + (chat.ai_response.length > 100 ? '...' : ''),
          icon: '🤖',
          path: '/files'
        })
      }
      
      console.log(`🤖 找到 ${chats.length} 条匹配的AI对话`)
    } catch (error) {
      console.error('❌ 搜索AI对话失败:', error)
    }
    
    // 搜索菜单项
    const menuItems = [
      { name: '仪表板', path: '/', icon: '📊' },
      { name: '项目管理', path: '/projects', icon: '📁' },
      { name: 'AI对话', path: '/files', icon: '🤖' },
      { name: '3D模型', path: '/ai-assistant', icon: '🎮' },
      { name: '团队管理', path: '/team', icon: '👥' },
      { name: '设置', path: '/settings', icon: '⚙️' }
    ]
    
    for (const item of menuItems) {
      if (item.name.toLowerCase().includes(query.toLowerCase())) {
        searchResults.push({
          id: `menu_${item.path}`,
          type: 'menu',
          title: item.name,
          description: `导航到${item.name}页面`,
          icon: item.icon,
          path: item.path
        })
      }
    }
    
    console.log(`📊 总共找到 ${searchResults.length} 个搜索结果`)
    
    res.json({
      success: true,
      data: searchResults
    })
  } catch (error) {
    console.error('❌ 搜索失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 好友系统相关接口
app.get('/api/friends/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    console.log(`👥 获取用户 ${userId} 的好友列表`)
    
    const [friends] = await pool.execute(
      `SELECT f.*, u.username, u.email 
       FROM friendships f 
       JOIN users u ON f.friend_id = u.id 
       WHERE f.user_id = ? AND f.status = 'accepted' 
       ORDER BY f.updated_at DESC`,
      [userId]
    )
    
    console.log(`📊 找到 ${friends.length} 个好友`)
    
    res.json({
      success: true,
      data: friends
    })
  } catch (error) {
    console.error('❌ 获取好友列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.post('/api/friends/add', async (req, res) => {
  try {
    const { userId, friendUsername } = req.body
    console.log(`👥 用户 ${userId} 添加好友 ${friendUsername}`)
    
    // 查找好友用户
    const [users] = await pool.execute(
      'SELECT id, username FROM users WHERE username = ?',
      [friendUsername]
    )
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      })
    }
    
    const friendId = users[0].id
    
    if (friendId === parseInt(userId)) {
      return res.status(400).json({
        success: false,
        error: '不能添加自己为好友'
      })
    }
    
    // 检查是否已经是好友
    const [existing] = await pool.execute(
      'SELECT id FROM friendships WHERE user_id = ? AND friend_id = ?',
      [userId, friendId]
    )
    
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: '已经是好友关系'
      })
    }
    
    // 添加好友请求
    await pool.execute(
      'INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [userId, friendId, 'pending']
    )
    
    console.log(`✅ 好友请求发送成功`)
    
    res.json({
      success: true,
      message: '好友请求发送成功'
    })
  } catch (error) {
    console.error('❌ 添加好友失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.post('/api/friends/respond', async (req, res) => {
  try {
    const { userId, friendId, action } = req.body
    console.log(`👥 用户 ${userId} ${action} 好友请求 ${friendId}`)
    
    const newStatus = action === 'accept' ? 'accepted' : 'blocked'
    
    // 更新好友状态（被邀请者处理邀请）
    // 注意：数据库中的记录是 user_id=发起者, friend_id=被邀请者
    // 所以需要交换参数来匹配数据库记录
    const [result] = await pool.execute(
      'UPDATE friendships SET status = ?, updated_at = NOW() WHERE user_id = ? AND friend_id = ?',
      [newStatus, friendId, userId]
    )
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: '好友请求不存在'
      })
    }
    
    // 如果是接受，创建反向好友关系（如果不存在）
    if (action === 'accept') {
      try {
        await pool.execute(
          'INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
          [userId, friendId, 'accepted']
        )
        console.log(`✅ 创建反向好友关系: ${friendId} -> ${userId}`)
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️ 反向好友关系已存在: ${friendId} -> ${userId}`)
        } else {
          throw error
        }
      }
    }
    
    console.log(`✅ 好友请求处理成功: ${newStatus}`)
    
    res.json({
      success: true,
      message: `好友请求${action === 'accept' ? '接受' : '拒绝'}成功`
    })
  } catch (error) {
    console.error('❌ 处理好友请求失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.get('/api/friends/pending/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    console.log(`👥 获取用户 ${userId} 的待处理好友请求`)
    
    const [pending] = await pool.execute(
      `SELECT f.*, u.username, u.email 
       FROM friendships f 
       JOIN users u ON f.user_id = u.id 
       WHERE f.friend_id = ? AND f.status = 'pending' 
       ORDER BY f.created_at DESC`,
      [userId]
    )
    
    console.log(`📊 找到 ${pending.length} 个待处理好友请求`)
    
    res.json({
      success: true,
      data: pending
    })
  } catch (error) {
    console.error('❌ 获取待处理好友请求失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 好友聊天相关接口
app.get('/api/friends/chat/:userId/:friendId', async (req, res) => {
  try {
    const { userId, friendId } = req.params
    console.log(`💬 获取用户 ${userId} 和 ${friendId} 的聊天记录`)
    
    const [messages] = await pool.execute(
      `SELECT fc.*, u.username as sender_name 
       FROM friend_chats fc 
       JOIN users u ON fc.sender_id = u.id 
       WHERE (fc.sender_id = ? AND fc.receiver_id = ?) 
       OR (fc.sender_id = ? AND fc.receiver_id = ?) 
       ORDER BY fc.created_at ASC`,
      [userId, friendId, friendId, userId]
    )
    
    console.log(`📊 找到 ${messages.length} 条聊天记录`)
    
    res.json({
      success: true,
      data: messages
    })
  } catch (error) {
    console.error('❌ 获取聊天记录失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.post('/api/friends/chat/send', async (req, res) => {
  try {
    const { senderId, receiverId, message } = req.body
    console.log(`💬 用户 ${senderId} 发送消息给 ${receiverId}`)
    
    // 保存聊天记录
    await pool.execute(
      'INSERT INTO friend_chats (sender_id, receiver_id, message, message_type, created_at) VALUES (?, ?, ?, ?, NOW())',
      [senderId, receiverId, message, 'text']
    )
    
    console.log(`✅ 消息发送成功`)
    
    res.json({
      success: true,
      message: '消息发送成功'
    })
  } catch (error) {
    console.error('❌ 发送消息失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 项目邀请通知相关接口
app.get('/api/invitations/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    console.log(`📧 获取用户 ${userId} 的项目邀请`)
    
    const [invitations] = await pool.execute(
      `SELECT pi.*, p.name as project_name, p.description as project_description, 
              u.username as inviter_name 
       FROM project_invitations pi 
       JOIN projects p ON pi.project_id = p.id 
       JOIN users u ON pi.inviter_id = u.id 
       WHERE pi.invitee_id = ? AND pi.status = 'pending' 
       ORDER BY pi.created_at DESC`,
      [userId]
    )
    
    console.log(`📊 找到 ${invitations.length} 个项目邀请`)
    
    res.json({
      success: true,
      data: invitations
    })
  } catch (error) {
    console.error('❌ 获取项目邀请失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.post('/api/invitations/respond', async (req, res) => {
  try {
    const { invitationId, action } = req.body
    console.log(`📧 处理项目邀请 ${invitationId}: ${action}`)
    
    const newStatus = action === 'accept' ? 'accepted' : 'rejected'
    
    // 更新邀请状态
    const [result] = await pool.execute(
      'UPDATE project_invitations SET status = ?, updated_at = NOW() WHERE id = ?',
      [newStatus, invitationId]
    )
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: '邀请不存在'
      })
    }
    
    // 如果接受邀请，添加用户到项目成员
    if (action === 'accept') {
      const [invitation] = await pool.execute(
        'SELECT * FROM project_invitations WHERE id = ?',
        [invitationId]
      )
      
      if (invitation.length > 0) {
        const inv = invitation[0]
        
        // 获取邀请者信息
        const [inviter] = await pool.execute(
          'SELECT username FROM users WHERE id = ?',
          [inv.inviter_id]
        )
        
        // 添加成员到项目
        await pool.execute(
          'INSERT INTO project_members (project_id, user_id, username, role, permissions, status, joined_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
          [
            inv.project_id,
            inv.invitee_id,
            inviter[0].username,
            'member',
            JSON.stringify({
              canEdit: false,
              canDelete: false,
              canInvite: false,
              canManageFiles: false,
              canViewLogs: true
            }),
            'active'
          ]
        )
      }
    }
    
    console.log(`✅ 项目邀请处理成功: ${newStatus}`)
    
    res.json({
      success: true,
      message: `项目邀请${action === 'accept' ? '接受' : '拒绝'}成功`
    })
  } catch (error) {
    console.error('❌ 处理项目邀请失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 团队管理相关接口
app.get('/api/team/my-projects/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    console.log(`👥 获取用户 ${userId} 创建的项目列表`)
    
    const [projects] = await pool.execute(
      'SELECT * FROM projects WHERE created_by_id = ? AND status = "active" ORDER BY created_at DESC',
      [userId]
    )
    
    console.log(`📊 找到 ${projects.length} 个用户创建的项目`)
    
    res.json({
      success: true,
      data: projects
    })
  } catch (error) {
    console.error('❌ 获取用户项目失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.get('/api/team/project-members/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params
    console.log(`👥 获取项目 ${projectId} 的成员列表`)
    
    const [members] = await pool.execute(
      'SELECT * FROM project_members WHERE project_id = ? ORDER BY joined_at ASC',
      [projectId]
    )
    
    console.log(`📊 找到 ${members.length} 个项目成员`)
    
    res.json({
      success: true,
      data: members
    })
  } catch (error) {
    console.error('❌ 获取项目成员失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.post('/api/team/remove-member', async (req, res) => {
  try {
    const { projectId, memberId } = req.body
    console.log(`🗑️ 从项目 ${projectId} 删除成员 ${memberId}`)
    
    // 检查是否为项目创建者
    const [project] = await pool.execute(
      'SELECT created_by_id FROM projects WHERE id = ?',
      [projectId]
    )
    
    if (project.length === 0) {
      return res.status(404).json({
        success: false,
        error: '项目不存在'
      })
    }
    
    // 删除成员
    const [result] = await pool.execute(
      'DELETE FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, memberId]
    )
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: '成员不存在'
      })
    }
    
    console.log(`✅ 成员删除成功`)
    
    res.json({
      success: true,
      message: '成员删除成功'
    })
  } catch (error) {
    console.error('❌ 删除成员失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.post('/api/team/toggle-ban-member', async (req, res) => {
  try {
    const { projectId, memberId, action } = req.body
    console.log(`🚫 在项目 ${projectId} 中${action === 'ban' ? '拉黑' : '解封'}成员 ${memberId}`)
    
    const newStatus = action === 'ban' ? 'inactive' : 'active'
    
    // 更新成员状态
    const [result] = await pool.execute(
      'UPDATE project_members SET status = ? WHERE project_id = ? AND user_id = ?',
      [newStatus, projectId, memberId]
    )
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: '成员不存在'
      })
    }
    
    console.log(`✅ 成员状态更新成功: ${newStatus}`)
    
    res.json({
      success: true,
      message: `成员${action === 'ban' ? '拉黑' : '解封'}成功`
    })
  } catch (error) {
    console.error('❌ 更新成员状态失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.post('/api/team/invite-member', async (req, res) => {
  try {
    const { projectId, username, message } = req.body
    console.log(`📧 邀请用户 ${username} 加入项目 ${projectId}`)
    
    // 查找用户
    const [users] = await pool.execute(
      'SELECT id, username FROM users WHERE username = ?',
      [username]
    )
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      })
    }
    
    const user = users[0]
    
    // 检查是否已经是成员
    const [existingMembers] = await pool.execute(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, user.id]
    )
    
    if (existingMembers.length > 0) {
      return res.status(400).json({
        success: false,
        error: '用户已经是项目成员'
      })
    }
    
    // 检查是否已有待处理的邀请
    const [existingInvitations] = await pool.execute(
      'SELECT id FROM project_invitations WHERE project_id = ? AND invitee_id = ? AND status = "pending"',
      [projectId, user.id]
    )
    
    if (existingInvitations.length > 0) {
      return res.status(400).json({
        success: false,
        error: '用户已有待处理的邀请'
      })
    }
    
    // 获取邀请者信息
    const [project] = await pool.execute(
      'SELECT created_by_id FROM projects WHERE id = ?',
      [projectId]
    )
    
    if (project.length === 0) {
      return res.status(404).json({
        success: false,
        error: '项目不存在'
      })
    }
    
    // 创建项目邀请通知
    await pool.execute(
      'INSERT INTO project_invitations (project_id, inviter_id, invitee_id, message, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [projectId, project[0].created_by_id, user.id, message || '', 'pending']
    )
    
    console.log(`✅ 项目邀请发送成功`)
    
    res.json({
      success: true,
      message: '邀请发送成功'
    })
  } catch (error) {
    console.error('❌ 发送邀请失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 项目相关接口
app.post('/api/projects/create', async (req, res) => {
  try {
    console.log('🚀 收到项目创建请求')
    const { name, description, type, id, createdAt, createdBy, createdById, members, memberIds, status } = req.body
    
    // 获取项目类型配置
    const projectTypeConfig = projectTypeService.getProjectTypeConfig(type)
    console.log(`📋 项目类型: ${type} (${projectTypeConfig.name})`)
    
    const result = await projectService.createProject({
      name,
      description,
      type,
      createdBy: createdBy || 'unknown_user',
      createdById: createdById || null,
      members: members || [],
      memberIds: memberIds || []
    })
    
    if (result.success) {
      console.log('✅ 项目创建成功')
      
      // 生成项目基础文件
      try {
        const projectFiles = projectTypeService.generateProjectFiles(type, name)
        console.log(`📁 生成 ${Object.keys(projectFiles).length} 个基础文件`)
        
        // 将基础文件保存到项目表中
        const projectId = result.data.id
        const projectName = result.data.name
        const safeTableName = projectService.generateSafeTableName(projectName)
        
        // 保存基础文件到主项目表
        const createdFolders = new Set()
        
        for (const [filePath, content] of Object.entries(projectFiles)) {
          const fileName = filePath.split('/').pop()
          const parentPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : null
          
          // 创建文件夹记录（如果不存在）
          if (parentPath) {
            const folderName = parentPath.split('/').pop()
            if (!createdFolders.has(parentPath)) {
              await pool.execute(
                `INSERT INTO \`${safeTableName}\` (file_name, file_path, parent_path, file_content, item_type, file_size, created_at, updated_at, status, created_by) VALUES (?, ?, ?, ?, 'folder', 0, NOW(), NOW(), 'active', ?)`,
                [folderName, parentPath, null, null, createdBy || 'unknown_user']
              )
              createdFolders.add(parentPath)
              console.log(`📁 创建文件夹: ${parentPath}`)
            }
          }
          
          // 保存文件
          await pool.execute(
            `INSERT INTO \`${safeTableName}\` (file_name, file_path, parent_path, file_content, item_type, file_size, created_at, updated_at, status, created_by) VALUES (?, ?, ?, ?, 'file', ?, NOW(), NOW(), 'active', ?)`,
            [fileName, filePath, parentPath, content, Buffer.byteLength(content, 'utf8'), createdBy || 'unknown_user']
          )
          
          console.log(`📄 保存文件: ${filePath}`)
        }
        
        // 更新项目统计信息
        await pool.execute(
          `UPDATE \`${safeTableName}\` SET child_count = ? WHERE file_name = ? AND item_type = 'folder'`,
          [Object.keys(projectFiles).length, 'src']
        )
        
        console.log('✅ 基础文件生成完成')
        
        // 返回包含基础文件信息的结果
        res.json({
          ...result,
          data: {
            ...result.data,
            baseFiles: Object.keys(projectFiles),
            projectType: projectTypeConfig.name,
            techStack: projectTypeConfig.techStack
          }
        })
      } catch (fileError) {
        console.error('⚠️ 基础文件生成失败:', fileError.message)
        // 即使文件生成失败，项目创建仍然成功
        res.json(result)
      }
    } else {
      console.error('❌ 项目创建失败:', result.error)
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('❌ 项目创建接口错误:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.post('/api/projects/join/:projectId', async (req, res) => {
  try {
    console.log('🚀 收到项目加入请求')
    const { projectId } = req.params
    const { userId, username } = req.body
    
    const result = await projectService.joinProject(projectId, userId || 'current_user', username)
    
    if (result.success) {
      console.log('✅ 项目加入成功')
      res.json(result)
    } else {
      console.error('❌ 项目加入失败:', result.error)
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('❌ 项目加入接口错误:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get('/api/projects/:projectId', async (req, res) => {
  try {
    console.log('🔍 收到项目查询请求')
    const { projectId } = req.params
    
    const result = await projectService.getProject(projectId)
    
    if (result.success) {
      console.log('✅ 项目查询成功')
      res.json(result)
    } else {
      console.error('❌ 项目查询失败:', result.error)
      res.status(404).json(result)
    }
  } catch (error) {
    console.error('❌ 项目查询接口错误:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get('/api/projects/:projectId/member-count', async (req, res) => {
  try {
    console.log('🔍 收到项目成员数量查询请求')
    const { projectId } = req.params
    
    const result = await projectService.getProjectMemberCount(projectId)
    
    if (result.success) {
      console.log('✅ 项目成员数量查询成功')
      res.json(result)
    } else {
      console.error('❌ 项目成员数量查询失败:', result.error)
      res.status(404).json(result)
    }
  } catch (error) {
    console.error('❌ 项目成员数量查询接口错误:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get('/api/projects/user/:userId', async (req, res) => {
  try {
    console.log('🔍 收到用户项目列表查询请求')
    const { userId } = req.params
    
    const result = await projectService.getUserProjects(userId)
    
    if (result.success) {
      console.log('✅ 用户项目列表查询成功')
      res.json(result)
    } else {
      console.error('❌ 用户项目列表查询失败:', result.error)
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('❌ 用户项目列表查询接口错误:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 项目项相关API
app.post('/api/projects/:projectId/items', async (req, res) => {
  try {
    console.log('💾 收到项目项保存请求')
    const { projectId } = req.params
    const itemData = req.body
    
    // 获取项目信息
    const projectResult = await projectService.getProject(projectId)
    if (!projectResult.success) {
      return res.status(404).json({ success: false, error: '项目不存在' })
    }
    
    const project = projectResult.data
    const result = await projectService.saveItemToProject(projectId, project.name, itemData)
    
    if (result.success) {
      console.log('✅ 项目项保存成功')
      res.json(result)
    } else {
      console.error('❌ 项目项保存失败:', result.error)
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('❌ 项目项保存接口错误:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 创建文件夹API
app.post('/api/projects/:projectId/folders', async (req, res) => {
  try {
    console.log('📁 收到创建文件夹请求')
    const { projectId } = req.params
    const folderData = req.body
    
    // 获取项目信息
    const projectResult = await projectService.getProject(projectId)
    if (!projectResult.success) {
      return res.status(404).json({ success: false, error: '项目不存在' })
    }
    
    const project = projectResult.data
    const result = await projectService.createFolder(projectId, project.name, folderData)
    
    if (result.success) {
      console.log('✅ 文件夹创建成功')
      res.json(result)
    } else {
      console.error('❌ 文件夹创建失败:', result.error)
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('❌ 创建文件夹接口错误:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 创建文件API
app.post('/api/projects/:projectId/files', async (req, res) => {
  try {
    console.log('📄 收到创建文件请求')
    const { projectId } = req.params
    const fileData = req.body
    
    // 获取项目信息
    const projectResult = await projectService.getProject(projectId)
    if (!projectResult.success) {
      return res.status(404).json({ success: false, error: '项目不存在' })
    }
    
    const project = projectResult.data
    const result = await projectService.createFile(projectId, project.name, fileData)
    
    if (result.success) {
      console.log('✅ 文件创建成功')
      res.json(result)
    } else {
      console.error('❌ 文件创建失败:', result.error)
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('❌ 创建文件接口错误:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 删除项目项API
app.delete('/api/projects/:projectId/items', async (req, res) => {
  try {
    console.log('🗑️ 收到删除项目项请求')
    const { projectId } = req.params
    const { itemPath } = req.body
    
    if (!itemPath) {
      return res.status(400).json({ success: false, error: '缺少项目项路径' })
    }
    
    // 获取项目信息
    const projectResult = await projectService.getProject(projectId)
    if (!projectResult.success) {
      return res.status(404).json({ success: false, error: '项目不存在' })
    }
    
    const project = projectResult.data
    const result = await projectService.deleteItem(projectId, project.name, itemPath)
    
    if (result.success) {
      console.log('✅ 项目项删除成功')
      res.json(result)
    } else {
      console.error('❌ 项目项删除失败:', result.error)
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('❌ 删除项目项接口错误:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get('/api/projects/:projectId/files', async (req, res) => {
  try {
    console.log('📋 收到项目文件列表查询请求')
    const { projectId } = req.params
    const { parent_path } = req.query
    
    // 获取项目信息
    const projectResult = await projectService.getProject(projectId)
    if (!projectResult.success) {
      return res.status(404).json({ success: false, error: '项目不存在' })
    }
    
    const project = projectResult.data
    const result = await projectService.getProjectFilesSimple(projectId, project.name, parent_path)
    
    if (result.success) {
      console.log('✅ 项目文件列表查询成功')
      res.json(result)
    } else {
      console.error('❌ 项目文件列表查询失败:', result.error)
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('❌ 项目文件列表查询接口错误:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 获取图片文件的Content-Type
function getImageContentType(fileName) {
  const ext = fileName.toLowerCase().split('.').pop()
  const contentTypes = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp'
  }
  return contentTypes[ext] || 'application/octet-stream'
}

// 获取项目文件预览
app.get('/api/projects/:projectId/preview', async (req, res) => {
  try {
    console.log('🖼️ 收到文件预览请求')
    const { projectId } = req.params
    const { filePath } = req.query
    
    if (!filePath) {
      return res.status(400).json({ success: false, error: '缺少文件路径参数' })
    }
    
    console.log(`📄 预览文件: ${filePath}`)
    
    // 获取项目信息
    const projectResult = await projectService.getProject(projectId)
    if (!projectResult.success) {
      return res.status(404).json({ success: false, error: '项目不存在' })
    }
    
    const project = projectResult.data
    
    // 标准化文件路径（确保以/开头）
    const normalizedFilePath = filePath.startsWith('/') ? filePath : `/${filePath}`
    
    // 查找文件内容
    const fileResult = await projectService.getFileContent(projectId, project.name, normalizedFilePath)
    
    if (!fileResult.success) {
      return res.status(404).json({ success: false, error: '文件不存在' })
    }
    
    const file = fileResult.data
    
    // 调试：打印文件对象结构
    console.log('🔍 文件对象结构:', {
      hasFileName: !!file.file_name,
      fileName: file.file_name,
      filePath: file.file_path,
      keys: Object.keys(file)
    })
    
    // 检查文件类型并处理
    if (file.file_name && (file.file_name.endsWith('.html') || file.file_name.endsWith('.htm'))) {
      // HTML文件需要处理相对资源路径
      let htmlContent = file.content
      
      // 替换CSS和JS的相对路径为API路径
      const baseApiUrl = `http://39.108.142.250:3000/api/projects/${projectId}/preview`
      
      // 处理CSS文件引用（只处理相对路径，不处理绝对路径）
      htmlContent = htmlContent.replace(
        /href=["']([^"']*\.css)["']/g, 
        (match, path) => {
          // 如果是绝对路径（以http://或https://开头），不处理
          if (path.startsWith('http://') || path.startsWith('https://')) {
            return match
          }
          // 只处理相对路径
          return `href="${baseApiUrl}?filePath=${path}"`
        }
      )
      
      // 处理JS/TS文件引用（只处理相对路径，不处理绝对路径）
      htmlContent = htmlContent.replace(
        /src=["']([^"']*\.(js|ts))["']/g, 
        (match, path) => {
          // 如果是绝对路径（以http://或https://开头），不处理
          if (path.startsWith('http://') || path.startsWith('https://')) {
            return match
          }
          // 只处理相对路径
          return `src="${baseApiUrl}?filePath=${path}"`
        }
      )
      
      // 处理图片文件引用（只处理相对路径，不处理绝对路径）
      htmlContent = htmlContent.replace(
        /src=["']([^"']*\.(png|jpg|jpeg|gif|svg|webp))["']/g, 
        (match, path) => {
          // 如果是绝对路径（以http://或https://开头），不处理
          if (path.startsWith('http://') || path.startsWith('https://')) {
            return match
          }
          // 只处理相对路径
          return `src="${baseApiUrl}?filePath=${path}"`
        }
      )
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
      res.send(htmlContent)
    } else if (file.file_name && file.file_name.endsWith('.vue')) {
      // Vue文件需要包装成可运行的HTML
      const vueContent = file.content
      
      // 解析Vue组件内容
      const templateMatch = vueContent.match(/<template[^>]*>([\s\S]*?)<\/template>/);
      const scriptMatch = vueContent.match(/<script[^>]*>([\s\S]*?)<\/script>/);
      const styleMatch = vueContent.match(/<style[^>]*>([\s\S]*?)<\/style>/);
      
      const template = templateMatch ? templateMatch[1].trim() : '<div>Vue组件</div>';
      const script = scriptMatch ? scriptMatch[1].trim() : '';
      const style = styleMatch ? styleMatch[1].trim() : '';
      
      // 创建可运行的Vue应用
      const htmlWrapper = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vue组件预览 - ${file.file_name}</title>
    <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
    <script src="https://unpkg.com/vue-router@4/dist/vue-router.global.js"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .vue-preview-container {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .vue-header {
            background: #42b883;
            color: white;
            padding: 15px 20px;
            font-weight: bold;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .vue-preview-content {
            flex: 1;
            padding: 20px;
            background: white;
            margin: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .vue-component-container {
            border: 2px dashed #42b883;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            background: #fafafa;
            min-height: 200px;
        }
        .vue-component-container h3 {
            margin: 0 0 15px 0;
            color: #42b883;
            font-size: 16px;
        }
        ${style}
    </style>
</head>
<body>
    <div class="vue-preview-container">
        <div class="vue-header">
            🎨 Vue组件实时预览: ${file.file_name}
        </div>
        <div class="vue-preview-content">
            <div class="vue-component-container">
                <h3>📱 组件预览效果:</h3>
                <div id="vue-app">
                    ${template}
                </div>
            </div>
        </div>
    </div>
    
    <script>
        const { createApp, ref, reactive, computed, onMounted, onUnmounted } = Vue;
        const { createRouter, createWebHashHistory } = VueRouter;
        
        // 解析Vue组件脚本
        let componentConfig;
        
        ${script ? `
        // 处理组件脚本
        try {
          // 移除ES6 import语句，避免模块错误
          let processedScript = \`${script}\`.replace(/import\\s+.*?from\\s+['"][^'"]+['"];?/g, '');
          processedScript = processedScript.replace(/export\\s+default\\s+/g, 'componentConfig = ');
          processedScript = processedScript.replace(/export\\s+\\{[^}]+\\}/g, '');
          
          // 执行处理后的脚本
          eval(processedScript);
          
          // 如果脚本中定义了组件配置，使用它
          if (typeof componentConfig !== 'undefined') {
            // 使用已定义的组件配置
          } else if (typeof App !== 'undefined') {
            componentConfig = App;
          } else {
            // 创建默认配置
            componentConfig = {
              data() {
                return {
                  message: 'Hello Vue!',
                  count: 0
                }
              },
              methods: {
                increment() {
                  this.count++
                }
              }
            }
          }
        } catch (error) {
          console.error('Vue组件脚本解析错误:', error);
          componentConfig = {
            data() {
              return {
                message: 'Vue组件预览',
                error: '脚本解析失败: ' + error.message
              }
            }
          }
        }
        ` : `
        // 默认组件配置
        componentConfig = {
          data() {
            return {
              message: 'Hello Vue!',
              count: 0
            }
          },
          methods: {
            increment() {
              this.count++
            }
          }
        }
        `}
        
        // 创建Vue应用
        const app = createApp(componentConfig);
        
        // 创建简单的路由（如果组件需要）
        const router = createRouter({
          history: createWebHashHistory(),
          routes: [
            { path: '/', component: { template: '<div>首页</div>' } },
            { path: '/about', component: { template: '<div>关于</div>' } },
            { path: '/contact', component: { template: '<div>联系</div>' } }
          ]
        });
        
        // 使用路由
        app.use(router);
        
        // 挂载应用
        app.mount('#vue-app');
    </script>
</body>
</html>`
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
      res.send(htmlWrapper)
    } else if (file.file_name && file.file_name.endsWith('.css')) {
      // CSS文件直接返回
      res.setHeader('Content-Type', 'text/css; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
      res.send(file.content)
    } else if (file.file_name && (file.file_name.endsWith('.js') || file.file_name.endsWith('.ts'))) {
      // JS/TS文件直接返回
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
      res.send(file.content)
    } else if (file.file_name && file.file_name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) {
      // 图片文件返回
      res.setHeader('Content-Type', getImageContentType(file.file_name))
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
      res.send(file.content)
    } else {
      return res.status(400).json({ success: false, error: '只能预览HTML、Vue、CSS、JS、TS和图片文件' })
    }
    
  } catch (error) {
    console.error('❌ 文件预览接口错误:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 获取文件内容
app.get('/api/projects/:projectId/file-content', async (req, res) => {
  try {
    console.log('📄 收到文件内容请求')
    const { projectId } = req.params
    const { filePath } = req.query
    
    if (!filePath) {
      return res.status(400).json({ success: false, error: '缺少文件路径参数' })
    }
    
    console.log(`📄 获取文件内容: ${filePath}`)
    
    // 获取项目信息
    const projectResult = await projectService.getProject(projectId)
    if (!projectResult.success) {
      return res.status(404).json({ success: false, error: '项目不存在' })
    }
    
    const project = projectResult.data
    
    // 查找文件内容
    const fileResult = await projectService.getFileContent(projectId, project.name, filePath)
    
    if (!fileResult.success) {
      return res.status(404).json({ success: false, error: '文件不存在' })
    }
    
    res.json({
      success: true,
      data: fileResult.data
    })
    
  } catch (error) {
    console.error('❌ 获取文件内容失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 更新文件内容
app.post('/api/projects/:projectId/update-file', async (req, res) => {
  try {
    console.log('✏️ 收到文件更新请求')
    const { projectId } = req.params
    const { filePath, content } = req.body
    
    if (!filePath || content === undefined) {
      return res.status(400).json({ success: false, error: '缺少文件路径或内容参数' })
    }
    
    console.log(`✏️ 更新文件: ${filePath}`)
    console.log(`📄 内容长度: ${content.length} 字符`)
    
    // 获取项目信息
    const projectResult = await projectService.getProject(projectId)
    if (!projectResult.success) {
      return res.status(404).json({ success: false, error: '项目不存在' })
    }
    
    const project = projectResult.data
    
    // 更新文件内容
    const updateResult = await projectService.updateFileContent(projectId, project.name, filePath, content)
    
    if (!updateResult.success) {
      return res.status(400).json({ success: false, error: updateResult.error })
    }
    
    res.json({
      success: true,
      message: '文件更新成功'
    })
    
  } catch (error) {
    console.error('❌ 更新文件失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 重新组织项目文件结构（创建文件夹）
app.post('/api/projects/:projectId/reorganize', async (req, res) => {
  try {
    console.log('📁 收到项目文件重组请求')
    const { projectId } = req.params
    
    // 获取项目信息
    const projectResult = await projectService.getProject(projectId)
    if (!projectResult.success) {
      return res.status(404).json({ success: false, error: '项目不存在' })
    }
    
    const project = projectResult.data
    const result = await projectService.reorganizeProjectStructure(projectId, project.name)
    
    if (result.success) {
      console.log('✅ 项目文件重组成功')
      res.json(result)
    } else {
      console.error('❌ 项目文件重组失败:', result.error)
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('❌ 项目文件重组接口错误:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 获取项目文件树结构
app.get('/api/projects/:projectId/file-tree', async (req, res) => {
  try {
    console.log('🌳 收到项目文件树查询请求')
    const { projectId } = req.params
    
    // 获取项目信息
    const projectResult = await projectService.getProject(projectId)
    if (!projectResult.success) {
      return res.status(404).json({ success: false, error: '项目不存在' })
    }
    
    const project = projectResult.data
    const result = await projectService.getProjectFileTree(projectId, project.name)
    
    if (result.success) {
      console.log('✅ 项目文件树查询成功')
      res.json(result)
    } else {
      console.error('❌ 项目文件树查询失败:', result.error)
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('❌ 项目文件树查询接口错误:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 项目日志相关API
app.get('/api/projects/:projectId/logs', async (req, res) => {
  try {
    console.log('📋 收到项目日志查询请求')
    const { projectId } = req.params
    const limit = parseInt(req.query.limit) || 10
    
    const result = await projectService.getProjectLogs(projectId, limit)
    
    if (result.success) {
      console.log('✅ 项目日志查询成功')
      res.json(result)
    } else {
      console.error('❌ 项目日志查询失败:', result.error)
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('❌ 项目日志查询接口错误:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 更新项目设置
app.put('/api/projects/:projectId/settings', async (req, res) => {
  try {
    console.log('⚙️ 收到项目设置更新请求')
    const { projectId } = req.params
    const settings = req.body
    
    // 验证设置数据
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        error: '设置数据格式错误'
      })
    }
    
    // 验证必要字段
    if (typeof settings.allowJoin !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'allowJoin 必须是布尔值'
      })
    }
    
    if (typeof settings.maxMembers !== 'number' || settings.maxMembers < 1 || settings.maxMembers > 50) {
      return res.status(400).json({
        success: false,
        error: 'maxMembers 必须是1-50之间的数字'
      })
    }
    
    // 更新项目设置
    const result = await projectService.updateProjectSettings(projectId, settings)
    
    if (result.success) {
      console.log('✅ 项目设置更新成功')
      res.json(result)
    } else {
      console.error('❌ 项目设置更新失败:', result.error)
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('❌ 项目设置更新接口错误:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 项目类型配置API
app.get('/api/project-types', async (req, res) => {
  try {
    console.log('📋 收到项目类型配置查询请求')
    
    const projectTypes = projectTypeService.getAllProjectTypes()
    
    res.json({
      success: true,
      data: projectTypes
    })
  } catch (error) {
    console.error('❌ 获取项目类型配置失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 获取特定项目类型的配置API
app.get('/api/project-types/:type', async (req, res) => {
  try {
    console.log(`📋 收到项目类型配置查询请求: ${req.params.type}`)
    
    const projectTypeConfig = projectTypeService.getProjectTypeConfig(req.params.type)
    
    res.json({
      success: true,
      data: projectTypeConfig
    })
  } catch (error) {
    console.error('❌ 获取项目类型配置失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// AI聊天API
app.post('/api/ai/chat', async (req, res) => {
  console.log('\n🤖 ===== 收到AI聊天请求 =====');
  console.log(`📅 时间: ${new Date().toLocaleString('zh-CN')}`);
  
  const { message, projectId, projectName, context } = req.body;
  
  console.log(`🚀 项目ID: ${projectId}`);
  console.log(`📝 项目名称: ${projectName}`);
  console.log(`💬 用户消息: ${message}`);
  
  if (!message || !projectId) {
    console.log('❌ 错误: 缺少必要参数');
    return res.status(400).json({
      success: false,
      error: '缺少必要参数'
    });
  }
  
  try {
    console.log('\n🧠 ===== 开始AI对话处理 =====');
    
    // 获取项目信息以确定项目类型
    const projectResult = await projectService.getProject(projectId);
    const projectType = projectResult.success ? projectResult.data.type : 'vue';
    console.log(`📋 项目类型: ${projectType}`);
    
    // 处理AI对话
    const result = await aiService.processChat(message, projectId, projectName, projectType, context);
    
    console.log('\n✅ ===== AI对话处理完成 =====');
    console.log(`📝 AI响应长度: ${result.response.length} 字符`);
    console.log(`🔧 操作数量: ${result.actions.length}`);
    
    // 执行代码修改操作
    if (result.actions && result.actions.length > 0) {
      console.log('\n🔧 ===== 开始执行代码修改操作 =====');
      
      for (const action of result.actions) {
        try {
          await aiService.executeCodeModification(action, projectId, projectName);
          console.log(`✅ 操作执行成功: ${action.description}`);
        } catch (error) {
          console.error(`❌ 操作执行失败: ${action.description}`, error);
        }
      }
      
      console.log('✅ ===== 代码修改操作执行完成 =====');
    }
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('❌ AI对话处理失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 通用AI对话API（不依赖项目）
app.post('/api/ai/general-chat', async (req, res) => {
  try {
    console.log('🤖 收到通用AI对话请求')
    const { message, userId = 'default_user' } = req.body
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数：message' 
      })
    }
    
    console.log(`📝 用户消息: ${message}`)
    console.log(`👤 用户ID: ${userId}`)
    
    try {
      // 获取当前用户的历史对话记录
      const [historyRecords] = await pool.execute(
        'SELECT user_message, ai_response FROM chathistory WHERE user_id = ? ORDER BY created_at ASC',
        [userId]
      );
      
      console.log(`📚 获取到用户 ${userId} 的 ${historyRecords.length} 条历史记录`);
      
      // 构建通用系统提示词
      const systemPrompt = `你是一个专业的AI代码助手，基于DeepSeek技术。你可以帮助用户：

• 分析和优化代码
• 创建新文件
• 修改现有文件
• 回答编程问题
• 提供技术建议
• 解释代码逻辑
• 调试问题
• 学习新技术

请用中文回复，提供清晰、准确的帮助。如果用户提供代码，请仔细分析并提供改进建议。

${historyRecords.length > 0 ? '以下是我们的完整对话历史，请参考上下文提供更准确的回答：' : ''}`;

      // 构建消息数组
      const messages = [{ role: 'system', content: systemPrompt }];
      
      // 添加当前用户的所有历史对话（按时间顺序）
      historyRecords.forEach(record => {
        messages.push({ role: 'user', content: record.user_message });
        messages.push({ role: 'assistant', content: record.ai_response });
      });
      
      // 添加当前用户消息
      messages.push({ role: 'user', content: message });
      
      console.log(`📨 发送给AI的消息数量: ${messages.length}`);
      
      // 调用DeepSeek API
      const aiResponse = await aiService.callDeepSeekAPI(messages);
      
      // 获取用户信息
      let userName = '用户';
      try {
        const [userRecords] = await pool.execute(
          'SELECT username FROM users WHERE id = ? OR username = ? LIMIT 1',
          [userId, userId]
        );
        if (userRecords.length > 0) {
          userName = userRecords[0].username;
        }
      } catch (error) {
        console.warn('⚠️ 获取用户信息失败，使用默认用户名:', error.message);
      }
      
      // 保存对话记录到chathistory表（绑定用户）
      await pool.execute(
        'INSERT INTO chathistory (user_id, user_name, user_message, ai_response) VALUES (?, ?, ?, ?)',
        [userId, userName, message, aiResponse]
      );
      
      console.log('✅ 通用AI对话处理完成，已保存到数据库')
      console.log(`📝 AI响应长度: ${aiResponse.length} 字符`)
      
      res.json({
        success: true,
        response: aiResponse
      })
    } catch (error) {
      console.error('❌ 通用AI对话处理失败:', error)
      res.status(500).json({ 
        success: false, 
        error: 'AI对话处理失败: ' + error.message 
      })
    }
  } catch (error) {
    console.error('❌ 通用AI对话接口错误:', error)
    res.status(500).json({ 
      success: false, 
      error: '服务器内部错误' 
    })
  }
})

// 获取用户聊天历史记录
app.get('/api/ai/chat-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    
    console.log(`📚 获取用户 ${userId} 的聊天历史，限制 ${limit} 条`);
    
    const [records] = await pool.execute(
      'SELECT id, user_message, ai_response, created_at FROM ai_conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, parseInt(limit)]
    );
    
    console.log(`📊 找到 ${records.length} 条聊天记录`);
    
    res.json({
      success: true,
      data: records,
      count: records.length
    });
    
  } catch (error) {
    console.error('❌ 获取聊天历史失败:', error);
    res.status(500).json({
      success: false,
      error: '获取聊天历史失败: ' + error.message
    });
  }
});

// 删除用户聊天历史记录
app.delete('/api/ai/chat-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`🗑️ 删除用户 ${userId} 的所有聊天历史`);
    
    const [result] = await pool.execute(
      'DELETE FROM ai_conversations WHERE user_id = ?',
      [userId]
    );
    
    console.log(`✅ 删除了 ${result.affectedRows} 条聊天记录`);
    
    res.json({
      success: true,
      message: `已删除 ${result.affectedRows} 条聊天记录`,
      deletedCount: result.affectedRows
    });
    
  } catch (error) {
    console.error('❌ 删除聊天历史失败:', error);
    res.status(500).json({
      success: false,
      error: '删除聊天历史失败: ' + error.message
    });
  }
});

// 获取指定用户的chathistory对话记录
app.get('/api/ai/chathistory/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`📚 获取用户 ${userId} 的对话记录`);
    
    const [records] = await pool.execute(
      'SELECT id, user_message, ai_response, created_at FROM chathistory WHERE user_id = ? ORDER BY created_at ASC',
      [userId]
    );
    
    console.log(`📊 找到用户 ${userId} 的 ${records.length} 条对话记录`);
    
    res.json({
      success: true,
      data: records,
      count: records.length,
      userId: userId
    });
    
  } catch (error) {
    console.error('❌ 获取chathistory失败:', error);
    res.status(500).json({
      success: false,
      error: '获取对话历史失败: ' + error.message
    });
  }
});

// 获取所有用户的chathistory对话记录（管理员功能）
app.get('/api/ai/chathistory', async (req, res) => {
  try {
    console.log('📚 获取所有用户的对话记录');
    
    const [records] = await pool.execute(
      'SELECT id, user_id, user_name, user_message, ai_response, created_at FROM chathistory ORDER BY created_at DESC'
    );
    
    console.log(`📊 找到 ${records.length} 条对话记录`);
    
    res.json({
      success: true,
      data: records,
      count: records.length
    });
    
  } catch (error) {
    console.error('❌ 获取chathistory失败:', error);
    res.status(500).json({
      success: false,
      error: '获取对话历史失败: ' + error.message
    });
  }
});

// 清空指定用户的chathistory记录
app.delete('/api/ai/chathistory/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🗑️ 清空用户 ${userId} 的对话记录`);
    
    const [result] = await pool.execute(
      'DELETE FROM chathistory WHERE user_id = ?',
      [userId]
    );
    
    console.log(`✅ 清空了用户 ${userId} 的 ${result.affectedRows} 条对话记录`);
    
    res.json({
      success: true,
      message: `已清空用户 ${userId} 的 ${result.affectedRows} 条对话记录`,
      deletedCount: result.affectedRows,
      userId: userId
    });
    
  } catch (error) {
    console.error('❌ 清空chathistory失败:', error);
    res.status(500).json({
      success: false,
      error: '清空对话历史失败: ' + error.message
    });
  }
});

// 获取AI操作历史
app.get('/api/ai-history', async (req, res) => {
  try {
    const folderPath = req.query.path;
    const limit = parseInt(req.query.limit) || 10;
    
    if (!folderPath) {
      return res.status(400).json({
        success: false,
        error: '缺少文件夹路径'
      });
    }
    
    console.log(`\n📋 请求获取AI操作历史: ${folderPath}`);
    
    const history = await aiService.getOperationHistory(folderPath, limit);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('❌ 获取AI操作历史失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取AI统计信息
app.get('/api/ai-stats', async (req, res) => {
  try {
    const folderPath = req.query.path;
    
    if (!folderPath) {
      return res.status(400).json({
        success: false,
        error: '缺少文件夹路径'
      });
    }
    
    console.log(`\n📊 请求获取AI统计信息: ${folderPath}`);
    
    const stats = await aiService.getAIStats(folderPath);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ 获取AI统计信息失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 开始监控文件夹
app.post('/api/watch-folder', async (req, res) => {
  try {
    const { folderPath } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({
        success: false,
        error: '缺少文件夹路径'
      });
    }
    
    console.log(`\n🔍 请求开始监控文件夹: ${folderPath}`);
    
    await fileWatcher.startWatching(folderPath);
    
    res.json({
      success: true,
      message: '文件夹监控已启动',
      data: {
        folderPath,
        status: 'watching'
      }
    });
  } catch (error) {
    console.error('❌ 启动文件夹监控失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 停止监控文件夹
app.post('/api/unwatch-folder', async (req, res) => {
  try {
    const { folderPath } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({
        success: false,
        error: '缺少文件夹路径'
      });
    }
    
    console.log(`\n🛑 请求停止监控文件夹: ${folderPath}`);
    
    await fileWatcher.stopWatching(folderPath);
    
    res.json({
      success: true,
      message: '文件夹监控已停止',
      data: {
        folderPath,
        status: 'stopped'
      }
    });
  } catch (error) {
    console.error('❌ 停止文件夹监控失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取监控状态
app.get('/api/watch-status', async (req, res) => {
  try {
    console.log('\n📊 请求获取监控状态');
    
    const status = fileWatcher.getWatchingStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('❌ 获取监控状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取实时文件变化
app.get('/api/file-changes', async (req, res) => {
  try {
    const folderPath = req.query.path;
    const limit = parseInt(req.query.limit) || 20;
    
    if (!folderPath) {
      return res.status(400).json({
        success: false,
        error: '缺少文件夹路径'
      });
    }
    
    console.log(`\n📝 请求获取文件变化记录: ${folderPath}`);
    
    // 获取最近的文件操作日志
    const [rows] = await pool.execute(
      `SELECT pl.*, fi.folder_path 
       FROM processing_logs pl
       JOIN folder_info fi ON pl.folder_id = fi.id
       WHERE fi.folder_path = ? 
       AND pl.action_type IN ('file_added', 'file_changed', 'file_deleted', 'directory_added', 'directory_deleted')
       ORDER BY pl.created_at DESC 
       LIMIT ${limit}`,
      [folderPath]
    );
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('❌ 获取文件变化记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 用户相关API路由

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    if (!username || !password || !email) {
      return res.status(400).json({
        success: false,
        error: '请提供完整的注册信息'
      });
    }
    
    const result = await userService.register({ username, password, email });
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ 用户注册失败:', error);
    res.status(500).json({
      success: false,
      error: '注册失败'
    });
  }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '请提供用户名和密码'
      });
    }
    
    const result = await userService.login({ username, password });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (error) {
    console.error('❌ 用户登录失败:', error);
    res.status(500).json({
      success: false,
      error: '登录失败'
    });
  }
});

// 获取用户信息
app.get('/api/auth/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await userService.getUserById(userId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('❌ 获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      error: '获取用户信息失败'
    });
  }
});

// 更新用户信息
app.put('/api/auth/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;
    const result = await userService.updateUser(userId, updateData);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ 更新用户信息失败:', error);
    res.status(500).json({
      success: false,
      error: '更新用户信息失败'
    });
  }
});

// 修改密码
app.put('/api/auth/user/:userId/password', async (req, res) => {
  try {
    const { userId } = req.params;
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: '请提供原密码和新密码'
      });
    }
    
    const result = await userService.changePassword(userId, oldPassword, newPassword);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ 修改密码失败:', error);
    res.status(500).json({
      success: false,
      error: '修改密码失败'
    });
  }
});

// 获取所有用户（管理员功能）
app.get('/api/auth/users', async (req, res) => {
  try {
    const result = await userService.getAllUsers();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('❌ 获取用户列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取用户列表失败'
    });
  }
});

// 获取用户仪表盘数据
app.get('/api/auth/dashboard/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 获取用户参与的项目
    const userProjects = await projectService.getUserProjects(userId);
    
    if (!userProjects.success) {
      return res.status(400).json(userProjects);
    }
    
    const projects = userProjects.data || [];
    
    // 计算统计数据
    let totalFiles = 0;
    let totalAIChats = 0;
    let uniqueMembers = new Set(); // 使用Set来存储唯一用户ID
    
    // 获取每个项目的详细信息
    for (const project of projects) {
      try {
        // 获取项目文件数量
        const filesResult = await projectService.getProjectFiles(project.id, project.name);
        if (filesResult.success) {
          totalFiles += filesResult.data.length;
        }
        
        // 获取项目成员详细信息（用于统计唯一用户）
        const projectResult = await projectService.getProject(project.id);
        if (projectResult.success && projectResult.data.memberDetails) {
          // 将项目成员的用户ID添加到Set中
          projectResult.data.memberDetails.forEach(member => {
            uniqueMembers.add(member.user_id);
          });
        }
        
        // 获取AI对话数量
        const aiChatsResult = await aiService.getProjectAIChats(project.id);
        if (aiChatsResult.success) {
          totalAIChats += aiChatsResult.data.length;
        }
      } catch (error) {
        console.error(`获取项目 ${project.id} 详细信息失败:`, error);
      }
    }
    
    // 计算唯一成员数量
    const totalMembers = uniqueMembers.size;
    
    // 获取最近的项目（按更新时间排序）
    const recentProjects = projects
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 5)
      .map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
        updatedAt: formatTimeAgo(new Date(project.updated_at))
      }));
    
    const dashboardData = {
      stats: {
        projects: projects.length,
        files: totalFiles,
        members: totalMembers,
        aiChats: totalAIChats
      },
      recentProjects: recentProjects
    };
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('❌ 获取用户仪表盘数据失败:', error);
    res.status(500).json({
      success: false,
      error: '获取仪表盘数据失败'
    });
  }
});

// 格式化时间差
function formatTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) {
    return '刚刚';
  } else if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}分钟前`;
  } else if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}小时前`;
  } else if (diffInSeconds < 2592000) {
    return `${Math.floor(diffInSeconds / 86400)}天前`;
  } else {
    return date.toLocaleDateString('zh-CN');
  }
}

// 启动服务器
async function startServer() {
  try {
    // 创建数据库（如果不存在）
    const dbCreated = await createDatabase();
    
    if (dbCreated) {
      // 测试数据库连接
      const dbConnected = await testConnection();
      
      if (dbConnected) {
        // 初始化数据库表
        await initDatabase();
        
        // 启动Express服务器
        app.listen(port,'0.0.0.0', () => {
          console.log(`\n🎉 后端服务器启动成功!`);
          console.log(`📍 服务器地址: http://localhost:${port}`);
          console.log(`📡 API端点:`);
                     console.log(`   - GET  /api/message`);
           console.log(`   - POST /api/data`);
           console.log(`   - POST /api/folder-info`);
           console.log(`   - GET  /api/folder-structure?path=<path>`);
           console.log(`   - GET  /api/folder?path=<path>`);
           console.log(`   - GET  /api/folders`);
           console.log(`   - DELETE /api/folder`);
           console.log(`   - GET  /api/statistics`);
           console.log(`   - POST /api/ai-chat`);
           console.log(`   - GET  /api/ai-history?path=<path>&limit=<limit>`);
           console.log(`   - GET  /api/ai-stats?path=<path>`);
          console.log(`\n⏳ 等待前端请求...\n`);
        });
      } else {
        console.error('❌ 无法启动服务器：数据库连接失败');
        process.exit(1);
      }
    } else {
      console.error('❌ 无法启动服务器：数据库创建失败');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 启动服务器失败:', error);
    process.exit(1);
  }
}

// 调试API：查看数据库表
app.get('/api/debug/tables/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // 获取项目信息
    const project = await projectService.getProject(projectId);
    if (!project.success) {
      return res.status(404).json({
        success: false,
        error: '项目不存在'
      });
    }
    
    const projectName = project.data.name;
    const safeTableName = projectService.generateSafeTableName(projectName);
    
    // 获取所有相关表
    const [allTables] = await pool.execute(`SHOW TABLES LIKE '${safeTableName}%'`);
    
    const tableInfo = [];
    for (const tableRow of allTables) {
      const tableName = Object.values(tableRow)[0];
      const [files] = await pool.execute(`SELECT file_name, item_type FROM \`${tableName}\` WHERE status = 'active'`);
      
      tableInfo.push({
        tableName: tableName,
        fileCount: files.length,
        files: files
      });
    }
    
    res.json({
      success: true,
      data: {
        projectName: projectName,
        safeTableName: safeTableName,
        tables: tableInfo
      }
    });
  } catch (error) {
    console.error('❌ 获取表信息失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 调试API：获取项目详细信息
app.get('/api/debug/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // 获取项目信息
    const project = await projectService.getProject(projectId);
    if (!project.success) {
      return res.status(404).json({
        success: false,
        error: '项目不存在'
      });
    }
    
    // 获取项目成员详细信息
    const memberCountResult = await projectService.getProjectMemberCount(projectId);
    
    // 获取项目文件数量
    const filesResult = await projectService.getProjectFiles(projectId, project.data.name);
    
    res.json({
      success: true,
      data: {
        project: project.data,
        memberCount: memberCountResult.success ? memberCountResult.data : 0,
        fileCount: filesResult.success ? filesResult.data.length : 0,
        members: project.data.members,
        memberDetails: project.data.memberDetails
      }
    });
  } catch (error) {
    console.error('❌ 获取项目调试信息失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 删除项目
app.delete('/api/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log(`🗑️ 收到删除项目请求: ${projectId}`);
    
    const result = await projectService.deleteProject(projectId);
    
    if (result.success) {
      console.log(`✅ 项目 ${projectId} 删除成功`);
      res.json({ success: true, message: '项目删除成功' });
    } else {
      console.error(`❌ 项目 ${projectId} 删除失败:`, result.error);
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('❌ 删除项目接口错误:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 获取项目成员数量
app.get('/api/projects/:projectId/members/count', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // 获取项目成员数量
    const memberCountResult = await projectService.getProjectMemberCount(projectId);
    
    if (!memberCountResult.success) {
      return res.status(404).json({
        success: false,
        error: '项目不存在'
      });
    }
    
    res.json({
      success: true,
      data: memberCountResult.data
    });
  } catch (error) {
    console.error('❌ 获取项目成员数量失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 获取项目文件数量
app.get('/api/projects/:projectId/files/count', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // 获取项目信息
    const project = await projectService.getProject(projectId);
    if (!project.success) {
      return res.status(404).json({
        success: false,
        error: '项目不存在'
      });
    }
    
    const projectName = project.data.name;
    
    // 获取项目文件数量
    const filesResult = await projectService.getProjectFiles(projectId, projectName);
    if (!filesResult.success) {
      return res.status(500).json({
        success: false,
        error: '获取文件列表失败'
      });
    }
    
    const fileCount = filesResult.data.length;
    
    res.json({
      success: true,
      data: fileCount
    });
  } catch (error) {
    console.error('❌ 获取项目文件数量失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 健康检查API
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// 启动服务器
startServer();

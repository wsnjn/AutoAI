const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || '39.108.142.250', // 您的服务器IP地址
  user: process.env.DB_USER || 'wslop', // 宝塔面板数据库用户名
  password: process.env.DB_PASSWORD || '345345', // 宝塔面板数据库密码
  database: process.env.DB_NAME || 'autoai',
  port: parseInt(process.env.DB_PORT) || 3306,
  charset: 'utf8mb4',
  timezone: process.env.DB_TIMEZONE || '+08:00',
  // 连接池配置
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  // 连接超时配置
  connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT) || 60000,
  // 强制使用 IPv4
  family: 4
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 测试数据库连接
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ 数据库连接成功!');
    console.log(`📍 数据库: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    return false;
  }
}

// 创建数据库（如果不存在）
async function createDatabase() {
  try {
    // 创建不指定数据库的连接
    const tempPool = mysql.createPool({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port
    });
    
    console.log('🔧 正在创建数据库...');
    await tempPool.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ 数据库 ${dbConfig.database} 创建成功`);
    
    await tempPool.end();
    return true;
  } catch (error) {
    console.error('❌ 创建数据库失败:', error.message);
    return false;
  }
}

// 初始化数据库表
async function initDatabase() {
  try {
    console.log('🔧 开始初始化数据库表...');
    
    // 创建文件夹信息主表（修改结构）
    const createFolderTable = `
      CREATE TABLE IF NOT EXISTS folder_info (
        id INT AUTO_INCREMENT PRIMARY KEY,
        folder_path VARCHAR(500) NOT NULL,
        folder_name VARCHAR(255) NOT NULL,
        table_name VARCHAR(100) NOT NULL,
        total_files INT DEFAULT 0,
        total_folders INT DEFAULT 0,
        total_size BIGINT DEFAULT 0,
        last_modified DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_folder_path (folder_path(255)),
        INDEX idx_table_name (table_name),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    // 创建处理日志表
    const createLogTable = `
      CREATE TABLE IF NOT EXISTS processing_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        folder_id INT,
        action_type VARCHAR(50) NOT NULL,
        status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
        message TEXT,
        details JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        FOREIGN KEY (folder_id) REFERENCES folder_info(id) ON DELETE CASCADE,
        INDEX idx_folder_id (folder_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await pool.execute(createFolderTable);
    console.log('✅ 文件夹信息主表创建成功');
    
    await pool.execute(createLogTable);
    console.log('✅ 处理日志表创建成功');
    
    // 创建AI对话表
    const createAIConversationTable = `
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        folder_path VARCHAR(500) NOT NULL,
        user_message TEXT NOT NULL,
        ai_response TEXT NOT NULL,
        actions JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_folder_path (folder_path(255)),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    // 创建代码修改表
    const createCodeModificationTable = `
      CREATE TABLE IF NOT EXISTS code_modifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        folder_path VARCHAR(500) NOT NULL,
        action_type VARCHAR(100) NOT NULL,
        description TEXT,
        language VARCHAR(50),
        code_content LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_folder_path (folder_path(255)),
        INDEX idx_action_type (action_type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await pool.execute(createAIConversationTable);
    console.log('✅ AI对话表创建成功');
    
    await pool.execute(createCodeModificationTable);
    console.log('✅ 代码修改表创建成功');
    
    // 创建好友关系表
    const createFriendshipsTable = `
      CREATE TABLE IF NOT EXISTS friendships (
        id INT AUTO_INCREMENT PRIMARY KEY COMMENT '好友关系唯一标识符',
        user_id INT NOT NULL COMMENT '用户ID',
        friend_id INT NOT NULL COMMENT '好友用户ID',
        status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending' COMMENT '好友状态',
        created_at DATETIME DEFAULT NULL COMMENT '创建时间',
        updated_at DATETIME DEFAULT NULL COMMENT '更新时间',
        UNIQUE KEY unique_friendship (user_id, friend_id),
        INDEX idx_user_id (user_id),
        INDEX idx_friend_id (friend_id),
        INDEX idx_status (status),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='好友关系表'
    `;
    
    // 创建好友聊天记录表
    const createFriendChatsTable = `
      CREATE TABLE IF NOT EXISTS friend_chats (
        id INT AUTO_INCREMENT PRIMARY KEY COMMENT '聊天记录唯一标识符',
        sender_id INT NOT NULL COMMENT '发送者ID',
        receiver_id INT NOT NULL COMMENT '接收者ID',
        message TEXT NOT NULL COMMENT '消息内容',
        message_type ENUM('text', 'image', 'file') DEFAULT 'text' COMMENT '消息类型',
        is_read BOOLEAN DEFAULT FALSE COMMENT '是否已读',
        created_at DATETIME DEFAULT NULL COMMENT '发送时间',
        INDEX idx_sender_id (sender_id),
        INDEX idx_receiver_id (receiver_id),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='好友聊天记录表'
    `;
    
    // 创建项目邀请通知表
    const createProjectInvitationsTable = `
      CREATE TABLE IF NOT EXISTS project_invitations (
        id INT AUTO_INCREMENT PRIMARY KEY COMMENT '邀请通知唯一标识符',
        project_id VARCHAR(50) NOT NULL COMMENT '项目ID',
        inviter_id INT NOT NULL COMMENT '邀请者ID',
        invitee_id INT NOT NULL COMMENT '被邀请者ID',
        message TEXT COMMENT '邀请消息',
        status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending' COMMENT '邀请状态',
        created_at DATETIME DEFAULT NULL COMMENT '创建时间',
        updated_at DATETIME DEFAULT NULL COMMENT '更新时间',
        INDEX idx_project_id (project_id),
        INDEX idx_inviter_id (inviter_id),
        INDEX idx_invitee_id (invitee_id),
        INDEX idx_status (status),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目邀请通知表'
    `;
    
    await pool.execute(createFriendshipsTable);
    console.log('✅ 好友关系表创建成功');
    
    await pool.execute(createFriendChatsTable);
    console.log('✅ 好友聊天记录表创建成功');
    
    await pool.execute(createProjectInvitationsTable);
    console.log('✅ 项目邀请通知表创建成功');
    
    console.log('🎉 数据库初始化完成!');
    return true;
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  testConnection,
  createDatabase,
  initDatabase,
  dbConfig
};

-- ============================================
-- AutoAI 智能云开发平台 - 完整数据库初始化脚本
-- ============================================
-- 数据库: autoai
-- 用户: root
-- 密码: 345345
-- 字符集: utf8mb4
-- 排序规则: utf8mb4_unicode_ci
-- ============================================

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS autoai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE autoai;

-- ============================================
-- 1. 用户管理相关表
-- ============================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '用户唯一标识符',
  username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
  password VARCHAR(255) NOT NULL COMMENT '加密后的密码',
  email VARCHAR(100) UNIQUE COMMENT '邮箱地址',
  avatar VARCHAR(500) COMMENT '头像URL',
  role ENUM('admin', 'user') DEFAULT 'user' COMMENT '用户角色',
  status ENUM('active', 'inactive', 'banned') DEFAULT 'active' COMMENT '用户状态',
  last_login TIMESTAMP NULL COMMENT '最后登录时间',
  created_at DATETIME DEFAULT NULL COMMENT '创建时间',
  updated_at DATETIME DEFAULT NULL COMMENT '更新时间',
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户信息表';

-- ============================================
-- 2. 项目管理相关表
-- ============================================

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(50) PRIMARY KEY COMMENT '项目唯一标识符',
  name VARCHAR(100) NOT NULL COMMENT '项目名称',
  description TEXT COMMENT '项目描述',
  type ENUM('html', 'vue', 'android', 'miniprogram', 'react') DEFAULT 'html' COMMENT '项目类型',
  created_by VARCHAR(50) NOT NULL COMMENT '创建者用户名',
  created_by_id INT NOT NULL COMMENT '创建者用户ID',
  members TEXT COMMENT '项目成员列表(JSON格式)',
  member_ids TEXT COMMENT '项目成员ID列表(JSON格式)',
  settings TEXT COMMENT '项目设置(JSON格式)',
  status ENUM('active', 'archived', 'deleted') DEFAULT 'active' COMMENT '项目状态',
  created_at DATETIME DEFAULT NULL COMMENT '创建时间',
  updated_at DATETIME DEFAULT NULL COMMENT '更新时间',
  INDEX idx_name (name),
  INDEX idx_type (type),
  INDEX idx_created_by (created_by),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目信息表';

-- 项目成员表
CREATE TABLE IF NOT EXISTS project_members (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '成员关系唯一标识符',
  project_id VARCHAR(50) NOT NULL COMMENT '项目ID',
  user_id INT NOT NULL COMMENT '用户ID',
  username VARCHAR(50) NOT NULL COMMENT '用户名',
  role ENUM('owner', 'admin', 'member') DEFAULT 'member' COMMENT '成员角色',
  permissions TEXT COMMENT '权限设置(JSON格式)',
  status ENUM('active', 'inactive', 'removed') DEFAULT 'active' COMMENT '成员状态',
  joined_at DATETIME DEFAULT NULL COMMENT '加入时间',
  updated_at DATETIME DEFAULT NULL COMMENT '更新时间',
  UNIQUE KEY unique_project_user (project_id, user_id),
  INDEX idx_project_id (project_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_joined_at (joined_at),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目成员关系表';

-- 项目日志表
CREATE TABLE IF NOT EXISTS project_logs (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '日志唯一标识符',
  project_id VARCHAR(50) NOT NULL COMMENT '项目ID',
  user_id INT NOT NULL COMMENT '操作用户ID',
  action VARCHAR(100) NOT NULL COMMENT '操作类型',
  details TEXT COMMENT '操作详情(JSON格式)',
  created_at DATETIME DEFAULT NULL COMMENT '操作时间',
  INDEX idx_project_id (project_id),
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目操作日志表';

-- 好友关系表
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='好友关系表';

-- 好友聊天记录表
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='好友聊天记录表';

-- 项目邀请通知表
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目邀请通知表';

-- ============================================
-- 3. 文件系统相关表
-- ============================================

-- 文件夹信息表（修改结构）
CREATE TABLE IF NOT EXISTS folder_info (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '文件夹唯一标识符',
  folder_path VARCHAR(500) NOT NULL COMMENT '文件夹路径',
  folder_name VARCHAR(255) NOT NULL COMMENT '文件夹名称',
  table_name VARCHAR(100) NOT NULL COMMENT '对应的数据表名',
  total_files INT DEFAULT 0 COMMENT '文件总数',
  total_folders INT DEFAULT 0 COMMENT '子文件夹总数',
  total_size BIGINT DEFAULT 0 COMMENT '总大小(字节)',
  last_modified DATETIME COMMENT '最后修改时间',
  created_at DATETIME DEFAULT NULL COMMENT '创建时间',
  updated_at DATETIME DEFAULT NULL COMMENT '更新时间',
  INDEX idx_folder_path (folder_path(255)),
  INDEX idx_table_name (table_name),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件夹信息表';

-- ============================================
-- 4. AI功能相关表
-- ============================================

-- AI对话记录表（项目级别）
CREATE TABLE IF NOT EXISTS ai_conversations (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '对话唯一标识符',
  project_id VARCHAR(50) COMMENT '项目ID',
  user_id INT NOT NULL COMMENT '用户ID',
  user_message TEXT NOT NULL COMMENT '用户消息',
  ai_response TEXT NOT NULL COMMENT 'AI回复',
  actions TEXT COMMENT 'AI执行的操作(JSON格式)',
  created_at DATETIME DEFAULT NULL COMMENT '对话时间',
  INDEX idx_project_id (project_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI对话记录表';

-- 聊天历史表（用户级别）
CREATE TABLE IF NOT EXISTS chathistory (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '聊天记录唯一标识符',
  user_id VARCHAR(50) NOT NULL COMMENT '用户ID',
  user_name VARCHAR(100) DEFAULT '用户' COMMENT '用户名',
  user_message TEXT NOT NULL COMMENT '用户消息',
  ai_response TEXT NOT NULL COMMENT 'AI回复',
  created_at DATETIME DEFAULT NULL COMMENT '聊天时间',
  updated_at DATETIME DEFAULT NULL COMMENT '更新时间',
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户聊天历史表';

-- 代码修改记录表
CREATE TABLE IF NOT EXISTS code_modifications (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '修改记录唯一标识符',
  project_id VARCHAR(50) COMMENT '项目ID',
  folder_path VARCHAR(500) NOT NULL COMMENT '文件夹路径',
  action_type VARCHAR(100) NOT NULL COMMENT '操作类型',
  description TEXT COMMENT '操作描述',
  language VARCHAR(50) COMMENT '编程语言',
  code_content LONGTEXT COMMENT '代码内容',
  created_at DATETIME DEFAULT NULL COMMENT '修改时间',
  INDEX idx_project_id (project_id),
  INDEX idx_folder_path (folder_path(255)),
  INDEX idx_action_type (action_type),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='代码修改记录表';

-- ============================================
-- 5. 系统日志相关表
-- ============================================

-- 处理日志表
CREATE TABLE IF NOT EXISTS processing_logs (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '日志唯一标识符',
  folder_id INT COMMENT '文件夹ID',
  action_type VARCHAR(50) NOT NULL COMMENT '操作类型',
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending' COMMENT '处理状态',
  message TEXT COMMENT '处理消息',
  details JSON COMMENT '处理详情(JSON格式)',
  created_at DATETIME DEFAULT NULL COMMENT '创建时间',
  completed_at TIMESTAMP NULL COMMENT '完成时间',
  INDEX idx_folder_id (folder_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (folder_id) REFERENCES folder_info(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='处理日志表';

-- ============================================
-- 6. 插入默认数据
-- ============================================

-- 插入默认管理员用户
INSERT INTO users (username, password, email, role, status) VALUES
('root', '$2a$10$rQz8vKz8vKz8vKz8vKz8vO', 'root@autoai.com', 'admin', 'active'),
('wslop', '$2a$10$rQz8vKz8vKz8vKz8vKz8vO', 'wslop@autoai.com', 'user', 'active')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- 7. 显示表结构信息
-- ============================================

-- 显示所有表
SHOW TABLES;

-- 显示表详细信息
DESCRIBE users;
DESCRIBE projects;
DESCRIBE project_members;
DESCRIBE project_logs;
DESCRIBE folder_info;
DESCRIBE ai_conversations;
DESCRIBE chathistory;
DESCRIBE code_modifications;
DESCRIBE processing_logs;

-- ============================================
-- 8. 数据库初始化完成提示
-- ============================================

SELECT 'AutoAI 数据库初始化完成！' as message;
SELECT '所有表已创建，默认用户已插入' as status;
SELECT '数据库版本: 1.0' as version;
SELECT '创建时间: ' as created_at, NOW() as timestamp;

const { pool } = require('../config/database');

class FolderService {
  // 生成表名（将路径转换为有效的表名）
  generateTableName(folderPath) {
    // 移除盘符和特殊字符，只保留文件夹名
    const pathParts = folderPath.split(/[\\\/]/);
    const folderName = pathParts[pathParts.length - 1] || 'root';
    
    // 转换为有效的表名（只包含字母、数字、下划线）
    let tableName = folderName.replace(/[^a-zA-Z0-9_]/g, '_');
    
    // 确保表名不以数字开头
    if (/^\d/.test(tableName)) {
      tableName = 'folder_' + tableName;
    }
    
    // 添加路径哈希以确保唯一性
    const pathHash = require('crypto').createHash('md5').update(folderPath).digest('hex').substring(0, 8);
    tableName = `${tableName}_${pathHash}`;
    
    return tableName.toLowerCase();
  }

  // 创建文件夹表
  async createFolderTable(folderPath, folderName) {
    try {
      const tableName = this.generateTableName(folderPath);
      
      console.log(`🔧 创建文件夹表: ${tableName}`);
      
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS \`${tableName}\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          path VARCHAR(500) NOT NULL,
          type ENUM('file', 'directory') DEFAULT 'file',
          size BIGINT DEFAULT 0,
          extension VARCHAR(50),
          last_modified DATETIME,
          parent_path VARCHAR(500),
          level INT DEFAULT 0,
          is_folder BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_name (name),
          INDEX idx_path (path(255)),
          INDEX idx_type (type),
          INDEX idx_level (level),
          INDEX idx_parent_path (parent_path(255))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      
      await pool.execute(createTableSQL);
      console.log(`✅ 文件夹表创建成功: ${tableName}`);
      
      return tableName;
    } catch (error) {
      console.error('❌ 创建文件夹表失败:', error.message);
      throw error;
    }
  }

  // 保存文件夹结构到数据库
  async saveFolderStructure(folderPath, folderStructure) {
    try {
      console.log('💾 开始保存文件夹结构到数据库...');
      console.log(`📂 文件夹路径: ${folderPath}`);
      
      // 创建主文件夹表
      const tableName = await this.createFolderTable(folderPath, folderStructure.name);
      
      // 清空现有数据
      await pool.execute(`DELETE FROM \`${tableName}\``);
      console.log('🗑️ 清理旧数据');
      
      // 保存文件夹信息到主表
      const folderId = await this.saveFolderInfo({
        folderPath,
        folderName: folderStructure.name || 'Unknown',
        tableName,
        totalFiles: folderStructure.fileCount || 0,
        totalFolders: folderStructure.folderCount || 0,
        totalSize: folderStructure.size || 0,
        lastModified: folderStructure.lastModified || new Date()
      });
      
      // 递归保存文件结构
      await this.saveFilesRecursively(tableName, folderStructure.children || [], folderPath, 0);
      
      console.log('✅ 文件夹结构保存完成');
      
      return {
        tableName,
        folderPath,
        folderName: folderStructure.name,
        folderId
      };
    } catch (error) {
      console.error('❌ 保存文件夹结构失败:', error.message);
      throw error;
    }
  }

  // 递归保存文件信息
  async saveFilesRecursively(tableName, items, parentPath, level) {
    for (const item of items) {
      try {
        const itemPath = parentPath ? `${parentPath}/${item.name}` : item.name;
        const isFolder = item.type === 'directory';
        
        await pool.execute(
          `INSERT INTO \`${tableName}\` 
           (name, path, type, size, extension, last_modified, parent_path, level, is_folder)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.name,
            itemPath,
            item.type,
            item.size || 0,
            item.extension || '',
            item.lastModified ? new Date(item.lastModified) : new Date(),
            parentPath || '',
            level,
            isFolder
          ]
        );
        
        // 如果是文件夹且有子项，递归处理
        if (isFolder && item.children && item.children.length > 0) {
          await this.saveFilesRecursively(tableName, item.children, itemPath, level + 1);
        }
      } catch (error) {
        console.error(`⚠️ 保存文件失败: ${item.name}`, error.message);
      }
    }
  }

  // 保存文件夹信息到主表
  async saveFolderInfo(folderData) {
    try {
      const {
        folderPath,
        folderName,
        tableName,
        totalFiles,
        totalFolders,
        totalSize,
        lastModified
      } = folderData;
      
      // 检查是否已存在相同路径的记录
      const [existingRows] = await pool.execute(
        'SELECT id FROM folder_info WHERE folder_path = ?',
        [folderPath]
      );
      
      let folderId;
      
      if (existingRows.length > 0) {
        // 更新现有记录
        const [result] = await pool.execute(
          `UPDATE folder_info SET 
           folder_name = ?, 
           table_name = ?,
           total_files = ?, 
           total_folders = ?, 
           total_size = ?, 
           last_modified = ?,
           updated_at = CURRENT_TIMESTAMP
           WHERE folder_path = ?`,
          [
            folderName,
            tableName,
            totalFiles,
            totalFolders,
            totalSize,
            lastModified ? new Date(lastModified) : new Date(),
            folderPath
          ]
        );
        
        folderId = existingRows[0].id;
        console.log(`🔄 更新文件夹信息: ID ${folderId}`);
      } else {
        // 插入新记录
        const [result] = await pool.execute(
          `INSERT INTO folder_info 
           (folder_path, folder_name, table_name, total_files, total_folders, total_size, last_modified)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            folderPath,
            folderName,
            tableName,
            totalFiles,
            totalFolders,
            totalSize,
            lastModified ? new Date(lastModified) : new Date()
          ]
        );
        
        folderId = result.insertId;
        console.log(`➕ 新增文件夹信息: ID ${folderId}`);
      }
      
      return folderId;
    } catch (error) {
      console.error('❌ 保存文件夹信息失败:', error.message);
      throw error;
    }
  }

  // 获取文件夹结构
  async getFolderStructure(folderPath) {
    try {
      console.log(`📊 获取文件夹结构: ${folderPath}`);
      
      // 获取文件夹信息
      const folderInfo = await this.getFolderInfo(folderPath);
      if (!folderInfo) {
        return null;
      }
      
      // 从对应的表中获取文件结构
      const [rows] = await pool.execute(
        `SELECT * FROM \`${folderInfo.table_name}\` ORDER BY level, name`
      );
      
      // 构建树形结构
      const fileTree = this.buildFileTree(rows);
      
      return {
        folderInfo,
        fileTree
      };
    } catch (error) {
      console.error('❌ 获取文件夹结构失败:', error.message);
      throw error;
    }
  }

  // 构建文件树
  buildFileTree(files) {
    const fileMap = new Map();
    const rootItems = [];
    
    // 创建文件映射
    files.forEach(file => {
      fileMap.set(file.path, {
        id: file.id,
        name: file.name,
        path: file.path,
        type: file.type,
        size: file.size,
        extension: file.extension,
        lastModified: file.last_modified,
        level: file.level,
        isFolder: file.is_folder,
        children: []
      });
    });
    
    // 构建树形结构
    files.forEach(file => {
      const fileNode = fileMap.get(file.path);
      
      if (file.level === 0) {
        // 根级文件
        rootItems.push(fileNode);
      } else {
        // 子文件，找到父级
        const parentPath = file.parent_path;
        const parentNode = fileMap.get(parentPath);
        if (parentNode) {
          parentNode.children.push(fileNode);
        }
      }
    });
    
    return rootItems;
  }

  // 获取文件夹信息
  async getFolderInfo(folderPath) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM folder_info WHERE folder_path = ?',
        [folderPath]
      );
      
      if (rows.length > 0) {
        return rows[0];
      }
      
      return null;
    } catch (error) {
      console.error('❌ 获取文件夹信息失败:', error.message);
      throw error;
    }
  }

  // 获取所有文件夹列表
  async getAllFolders() {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM folder_info ORDER BY created_at DESC'
      );
      
      return rows;
    } catch (error) {
      console.error('❌ 获取文件夹列表失败:', error.message);
      throw error;
    }
  }

  // 创建处理日志
  async createProcessingLog(folderId, actionType, message = '', details = {}) {
    try {
      const [result] = await pool.execute(
        `INSERT INTO processing_logs 
         (folder_id, action_type, message, details)
         VALUES (?, ?, ?, ?)`,
        [folderId, actionType, message, JSON.stringify(details)]
      );
      
      console.log(`📝 创建处理日志: ID ${result.insertId}, 类型: ${actionType}`);
      return result.insertId;
    } catch (error) {
      console.error('❌ 创建处理日志失败:', error.message);
      throw error;
    }
  }

  // 更新处理日志状态
  async updateProcessingLog(logId, status, message = '', details = {}) {
    try {
      await pool.execute(
        `UPDATE processing_logs SET 
         status = ?, 
         message = ?, 
         details = ?,
         completed_at = ${status === 'completed' || status === 'failed' ? 'CURRENT_TIMESTAMP' : 'NULL'}
         WHERE id = ?`,
        [status, message, JSON.stringify(details), logId]
      );
      
      console.log(`📝 更新处理日志: ID ${logId}, 状态: ${status}`);
    } catch (error) {
      console.error('❌ 更新处理日志失败:', error.message);
      throw error;
    }
  }

  // 获取统计信息
  async getStatistics() {
    try {
      const [folderCount] = await pool.execute('SELECT COUNT(*) as count FROM folder_info');
      const [recentFolders] = await pool.execute(
        'SELECT folder_name, table_name, created_at FROM folder_info ORDER BY created_at DESC LIMIT 5'
      );
      
      // 计算总文件数（遍历所有表）
      let totalFiles = 0;
      for (const folder of recentFolders) {
        try {
          const [fileCount] = await pool.execute(`SELECT COUNT(*) as count FROM \`${folder.table_name}\``);
          totalFiles += fileCount[0].count;
        } catch (error) {
          console.warn(`⚠️ 无法统计表 ${folder.table_name} 的文件数`);
        }
      }
      
      return {
        totalFolders: folderCount[0].count,
        totalFiles,
        recentFolders
      };
    } catch (error) {
      console.error('❌ 获取统计信息失败:', error.message);
      throw error;
    }
  }

  // 删除文件夹及其表
  async deleteFolder(folderPath) {
    try {
      console.log(`🗑️ 删除文件夹: ${folderPath}`);
      
      const folderInfo = await this.getFolderInfo(folderPath);
      if (!folderInfo) {
        throw new Error('文件夹不存在');
      }
      
      // 删除对应的表
      await pool.execute(`DROP TABLE IF EXISTS \`${folderInfo.table_name}\``);
      console.log(`🗑️ 删除表: ${folderInfo.table_name}`);
      
      // 删除主表记录
      await pool.execute('DELETE FROM folder_info WHERE folder_path = ?', [folderPath]);
      console.log(`🗑️ 删除主表记录`);
      
      return true;
    } catch (error) {
      console.error('❌ 删除文件夹失败:', error.message);
      throw error;
    }
  }
}

module.exports = new FolderService();

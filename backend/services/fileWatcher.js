const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { pool } = require('../config/database');
const folderService = require('./folderService');

class FileWatcher {
  constructor() {
    this.watchers = new Map(); // 存储每个文件夹的监控器
    this.isWatching = false;
  }

  // 开始监控文件夹
  async startWatching(folderPath) {
    try {
      console.log(`🔍 开始监控文件夹: ${folderPath}`);
      
      if (this.watchers.has(folderPath)) {
        console.log(`⚠️ 文件夹 ${folderPath} 已在监控中`);
        return;
      }

      // 创建文件监控器
      const watcher = chokidar.watch(folderPath, {
        persistent: true,
        ignoreInitial: false,
        ignored: [
          /node_modules/,
          /\.git/,
          /\.vscode/,
          /\.idea/,
          /\.DS_Store/,
          /\.tmp/,
          /\.log/
        ],
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100
        }
      });

      // 监听文件变化事件
      watcher
        .on('add', (filePath) => this.handleFileChange('add', filePath, folderPath))
        .on('change', (filePath) => this.handleFileChange('change', filePath, folderPath))
        .on('unlink', (filePath) => this.handleFileChange('delete', filePath, folderPath))
        .on('addDir', (dirPath) => this.handleFileChange('addDir', dirPath, folderPath))
        .on('unlinkDir', (dirPath) => this.handleFileChange('deleteDir', dirPath, folderPath))
        .on('error', (error) => console.error('❌ 文件监控错误:', error))
        .on('ready', () => {
          console.log(`✅ 文件夹 ${folderPath} 监控就绪`);
          this.isWatching = true;
        });

      this.watchers.set(folderPath, watcher);
      
      // 记录监控开始日志
      await this.logFileOperation(folderPath, 'watch_start', '开始监控文件夹', {
        folderPath,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`❌ 启动文件夹监控失败: ${folderPath}`, error);
      throw error;
    }
  }

  // 停止监控文件夹
  async stopWatching(folderPath) {
    try {
      console.log(`🛑 停止监控文件夹: ${folderPath}`);
      
      const watcher = this.watchers.get(folderPath);
      if (watcher) {
        await watcher.close();
        this.watchers.delete(folderPath);
        
        // 记录监控停止日志
        await this.logFileOperation(folderPath, 'watch_stop', '停止监控文件夹', {
          folderPath,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(`❌ 停止文件夹监控失败: ${folderPath}`, error);
    }
  }

  // 处理文件变化
  async handleFileChange(eventType, filePath, folderPath) {
    try {
      console.log(`📝 检测到文件变化: ${eventType} - ${filePath}`);
      
      // 获取相对路径
      const relativePath = path.relative(folderPath, filePath);
      
      // 根据事件类型处理
      switch (eventType) {
        case 'add':
          await this.handleFileAdded(filePath, relativePath, folderPath);
          break;
        case 'change':
          await this.handleFileChanged(filePath, relativePath, folderPath);
          break;
        case 'delete':
          await this.handleFileDeleted(filePath, relativePath, folderPath);
          break;
        case 'addDir':
          await this.handleDirectoryAdded(filePath, relativePath, folderPath);
          break;
        case 'deleteDir':
          await this.handleDirectoryDeleted(filePath, relativePath, folderPath);
          break;
      }
      
      // 更新文件夹结构
      await this.updateFolderStructure(folderPath);
      
    } catch (error) {
      console.error(`❌ 处理文件变化失败: ${eventType} - ${filePath}`, error);
    }
  }

  // 处理文件添加
  async handleFileAdded(filePath, relativePath, folderPath) {
    try {
      const stats = fs.statSync(filePath);
      const fileInfo = {
        name: path.basename(filePath),
        path: relativePath,
        type: 'file',
        size: stats.size,
        lastModified: stats.mtime,
        extension: path.extname(filePath)
      };

      // 保存到数据库
      await this.saveFileToDatabase(folderPath, fileInfo);
      
      // 记录操作日志
      await this.logFileOperation(folderPath, 'file_added', `添加文件: ${relativePath}`, {
        filePath: relativePath,
        fileSize: stats.size,
        fileType: path.extname(filePath)
      });

    } catch (error) {
      console.error(`❌ 处理文件添加失败: ${filePath}`, error);
    }
  }

  // 处理文件修改
  async handleFileChanged(filePath, relativePath, folderPath) {
    try {
      const stats = fs.statSync(filePath);
      
      // 更新数据库中的文件信息
      await this.updateFileInDatabase(folderPath, relativePath, {
        size: stats.size,
        lastModified: stats.mtime
      });
      
      // 记录操作日志
      await this.logFileOperation(folderPath, 'file_changed', `修改文件: ${relativePath}`, {
        filePath: relativePath,
        newSize: stats.size,
        lastModified: stats.mtime
      });

    } catch (error) {
      console.error(`❌ 处理文件修改失败: ${filePath}`, error);
    }
  }

  // 处理文件删除
  async handleFileDeleted(filePath, relativePath, folderPath) {
    try {
      // 从数据库中删除文件
      await this.deleteFileFromDatabase(folderPath, relativePath);
      
      // 记录操作日志
      await this.logFileOperation(folderPath, 'file_deleted', `删除文件: ${relativePath}`, {
        filePath: relativePath
      });

    } catch (error) {
      console.error(`❌ 处理文件删除失败: ${filePath}`, error);
    }
  }

  // 处理目录添加
  async handleDirectoryAdded(dirPath, relativePath, folderPath) {
    try {
      const stats = fs.statSync(dirPath);
      const dirInfo = {
        name: path.basename(dirPath),
        path: relativePath,
        type: 'directory',
        size: 0,
        lastModified: stats.mtime
      };

      // 保存到数据库
      await this.saveDirectoryToDatabase(folderPath, dirInfo);
      
      // 记录操作日志
      await this.logFileOperation(folderPath, 'directory_added', `添加目录: ${relativePath}`, {
        dirPath: relativePath
      });

    } catch (error) {
      console.error(`❌ 处理目录添加失败: ${dirPath}`, error);
    }
  }

  // 处理目录删除
  async handleDirectoryDeleted(dirPath, relativePath, folderPath) {
    try {
      // 从数据库中删除目录
      await this.deleteDirectoryFromDatabase(folderPath, relativePath);
      
      // 记录操作日志
      await this.logFileOperation(folderPath, 'directory_deleted', `删除目录: ${relativePath}`, {
        dirPath: relativePath
      });

    } catch (error) {
      console.error(`❌ 处理目录删除失败: ${dirPath}`, error);
    }
  }

  // 更新文件夹结构
  async updateFolderStructure(folderPath) {
    try {
      console.log(`🔄 更新文件夹结构: ${folderPath}`);
      
      // 重新扫描文件夹
      const structure = this.scanFolderStructure(folderPath);
      
      // 更新数据库中的文件夹信息
      await this.updateFolderInfo(folderPath, structure);
      
      // 记录结构更新日志
      await this.logFileOperation(folderPath, 'structure_updated', '更新文件夹结构', {
        totalFiles: structure.fileCount,
        totalFolders: structure.folderCount,
        totalSize: structure.size
      });

    } catch (error) {
      console.error(`❌ 更新文件夹结构失败: ${folderPath}`, error);
    }
  }

  // 扫描文件夹结构
  scanFolderStructure(folderPath, maxDepth = 3, currentDepth = 0) {
    try {
      const stats = fs.statSync(folderPath);
      if (!stats.isDirectory()) {
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
      
      for (const item of items) {
        const itemPath = path.join(folderPath, item);
        
        try {
          const itemStats = fs.statSync(itemPath);
          
          if (itemStats.isDirectory()) {
            structure.folderCount++;
            
            if (currentDepth < maxDepth) {
              const childStructure = this.scanFolderStructure(itemPath, maxDepth, currentDepth + 1);
              if (childStructure) {
                structure.children.push(childStructure);
              }
            }
          } else {
            structure.fileCount++;
            structure.children.push({
              name: item,
              path: path.relative(folderPath, itemPath),
              type: 'file',
              size: itemStats.size,
              lastModified: itemStats.mtime,
              extension: path.extname(item)
            });
          }
        } catch (error) {
          console.log(`⚠️ 无法访问项目: ${itemPath} - ${error.message}`);
        }
      }

      // 计算文件夹总大小
      structure.size = this.calculateFolderSize(structure);
      
      return structure;
    } catch (error) {
      console.error(`❌ 扫描文件夹失败: ${folderPath}`, error);
      return null;
    }
  }

  // 计算文件夹大小
  calculateFolderSize(structure) {
    let totalSize = 0;
    
    for (const child of structure.children) {
      if (child.type === 'file') {
        totalSize += child.size || 0;
      } else if (child.type === 'directory') {
        totalSize += this.calculateFolderSize(child);
      }
    }
    
    return totalSize;
  }

  // 保存文件到数据库
  async saveFileToDatabase(folderPath, fileInfo) {
    try {
      const [folderRows] = await pool.execute(
        'SELECT * FROM folder_info WHERE folder_path = ?',
        [folderPath]
      );

      if (folderRows.length === 0) {
        console.log(`⚠️ 文件夹信息不存在: ${folderPath}`);
        return;
      }

      const folderInfo = folderRows[0];
      const tableName = folderInfo.table_name;

      // 检查文件是否已存在
      const [existingFiles] = await pool.execute(
        `SELECT * FROM \`${tableName}\` WHERE path = ?`,
        [fileInfo.path]
      );

      if (existingFiles.length === 0) {
        // 插入新文件
        await pool.execute(
          `INSERT INTO \`${tableName}\` (name, path, type, size, last_modified, extension, level, parent_path)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            fileInfo.name,
            fileInfo.path,
            fileInfo.type,
            fileInfo.size,
            fileInfo.lastModified,
            fileInfo.extension,
            fileInfo.path.split(path.sep).length - 1,
            path.dirname(fileInfo.path)
          ]
        );
      }
    } catch (error) {
      console.error(`❌ 保存文件到数据库失败: ${fileInfo.path}`, error);
    }
  }

  // 更新数据库中的文件信息
  async updateFileInDatabase(folderPath, relativePath, updates) {
    try {
      const [folderRows] = await pool.execute(
        'SELECT * FROM folder_info WHERE folder_path = ?',
        [folderPath]
      );

      if (folderRows.length === 0) return;

      const folderInfo = folderRows[0];
      const tableName = folderInfo.table_name;

      await pool.execute(
        `UPDATE \`${tableName}\` SET size = ?, last_modified = ? WHERE path = ?`,
        [updates.size, updates.lastModified, relativePath]
      );
    } catch (error) {
      console.error(`❌ 更新文件信息失败: ${relativePath}`, error);
    }
  }

  // 从数据库中删除文件
  async deleteFileFromDatabase(folderPath, relativePath) {
    try {
      const [folderRows] = await pool.execute(
        'SELECT * FROM folder_info WHERE folder_path = ?',
        [folderPath]
      );

      if (folderRows.length === 0) return;

      const folderInfo = folderRows[0];
      const tableName = folderInfo.table_name;

      await pool.execute(
        `DELETE FROM \`${tableName}\` WHERE path = ?`,
        [relativePath]
      );
    } catch (error) {
      console.error(`❌ 删除文件记录失败: ${relativePath}`, error);
    }
  }

  // 保存目录到数据库
  async saveDirectoryToDatabase(folderPath, dirInfo) {
    try {
      const [folderRows] = await pool.execute(
        'SELECT * FROM folder_info WHERE folder_path = ?',
        [folderPath]
      );

      if (folderRows.length === 0) return;

      const folderInfo = folderRows[0];
      const tableName = folderInfo.table_name;

      // 检查目录是否已存在
      const [existingDirs] = await pool.execute(
        `SELECT * FROM \`${tableName}\` WHERE path = ?`,
        [dirInfo.path]
      );

      if (existingDirs.length === 0) {
        await pool.execute(
          `INSERT INTO \`${tableName}\` (name, path, type, size, last_modified, level, parent_path)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            dirInfo.name,
            dirInfo.path,
            dirInfo.type,
            dirInfo.size,
            dirInfo.lastModified,
            dirInfo.path.split(path.sep).length - 1,
            path.dirname(dirInfo.path)
          ]
        );
      }
    } catch (error) {
      console.error(`❌ 保存目录到数据库失败: ${dirInfo.path}`, error);
    }
  }

  // 从数据库中删除目录
  async deleteDirectoryFromDatabase(folderPath, relativePath) {
    try {
      const [folderRows] = await pool.execute(
        'SELECT * FROM folder_info WHERE folder_path = ?',
        [folderPath]
      );

      if (folderRows.length === 0) return;

      const folderInfo = folderRows[0];
      const tableName = folderInfo.table_name;

      // 删除目录及其所有子文件
      await pool.execute(
        `DELETE FROM \`${tableName}\` WHERE path = ? OR path LIKE ?`,
        [relativePath, `${relativePath}%`]
      );
    } catch (error) {
      console.error(`❌ 删除目录记录失败: ${relativePath}`, error);
    }
  }

  // 更新文件夹信息
  async updateFolderInfo(folderPath, structure) {
    try {
      await pool.execute(
        `UPDATE folder_info SET 
         total_files = ?, 
         total_folders = ?, 
         total_size = ?, 
         last_modified = ?,
         updated_at = CURRENT_TIMESTAMP
         WHERE folder_path = ?`,
        [
          structure.fileCount,
          structure.folderCount,
          structure.size,
          structure.lastModified,
          folderPath
        ]
      );
    } catch (error) {
      console.error(`❌ 更新文件夹信息失败: ${folderPath}`, error);
    }
  }

  // 记录文件操作日志
  async logFileOperation(folderPath, operationType, description, details) {
    try {
      const [folderRows] = await pool.execute(
        'SELECT id FROM folder_info WHERE folder_path = ?',
        [folderPath]
      );

      if (folderRows.length === 0) return;

      const folderId = folderRows[0].id;

      await pool.execute(
        `INSERT INTO processing_logs (folder_id, action_type, status, message, details, created_at)
         VALUES (?, ?, 'completed', ?, ?, CURRENT_TIMESTAMP)`,
        [folderId, operationType, description, JSON.stringify(details)]
      );

      console.log(`📝 记录操作日志: ${operationType} - ${description}`);
    } catch (error) {
      console.error(`❌ 记录操作日志失败: ${operationType}`, error);
    }
  }

  // 获取监控状态
  getWatchingStatus() {
    return {
      isWatching: this.isWatching,
      watchedFolders: Array.from(this.watchers.keys()),
      totalWatched: this.watchers.size
    };
  }

  // 停止所有监控
  async stopAllWatching() {
    console.log('🛑 停止所有文件夹监控');
    
    for (const [folderPath, watcher] of this.watchers) {
      await this.stopWatching(folderPath);
    }
    
    this.isWatching = false;
  }
}

module.exports = new FileWatcher();

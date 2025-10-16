const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { pool } = require('../config/database');
const projectTypeService = require('./projectTypeService');

class AIService {
  constructor() {
    this.apiKey = '';
    this.baseURL = 'https://api.deepseek.com/v1';
    this.conversationHistory = [];
  }

  // 调用DeepSeek API
  async callDeepSeekAPI(messages) {
    try {
      console.log('🤖 正在调用DeepSeek API...');
      
      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: 'deepseek-chat',
        messages: messages,
        temperature: 0.7,
        max_tokens: 4000,
        stream: false
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ DeepSeek API调用成功');
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('❌ DeepSeek API调用失败:', error.response?.data || error.message);
      throw new Error(`AI服务调用失败: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // 构建系统提示词
  buildSystemPrompt(projectId, projectName, projectType, previousMessages) {
    // 获取项目类型特定的AI提示词
    const typeSpecificPrompt = projectTypeService.getAIPrompt(projectType)
    const projectTypeConfig = projectTypeService.getProjectTypeConfig(projectType)
    
    return `${typeSpecificPrompt}

当前项目信息：
- 项目ID: ${projectId}
- 项目名称: ${projectName}
- 项目类型: ${projectTypeConfig.name}
- 技术栈: ${projectTypeConfig.techStack}

你的能力：
1. 分析现有代码结构
2. 提供代码修改建议
3. 生成新的代码文件
4. 优化现有功能
5. 修复代码问题
6. 重构代码结构
7. 管理项目文件

重要规则：
- 每次修改都要记录详细的操作日志
- 生成的代码要符合最佳实践
- 提供清晰的修改说明
- 确保代码的可维护性和可扩展性
- 所有文件操作都会保存到项目数据库中

文件操作格式：
当需要创建新文件时，请使用以下格式：
\`\`\`语言
代码内容
\`\`\`
创建文件: 文件名.扩展名

当需要修改现有文件时，请使用以下格式：
文件操作: 修改 文件名.扩展名
\`\`\`语言
代码内容
\`\`\`

当需要删除文件时，请使用以下格式：
文件操作: 删除 文件名.扩展名

请根据项目类型和技术栈，提供专业的代码建议和解决方案。始终使用中文回复，代码要清晰易懂。`;
  }

  // 构建用户消息
  buildUserMessage(userInput, context) {
    let message = userInput;
    
    if (context && context.previousMessages && context.previousMessages.length > 0) {
      message += '\n\n历史对话上下文：\n';
      context.previousMessages.forEach(msg => {
        message += `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}\n`;
      });
    }
    
    return message;
  }

  // 处理AI对话
  async processChat(userInput, projectId, projectName, projectType, context) {
    try {
      console.log('🧠 开始处理AI对话...');
      
      // 在AI请求前清理项目中所有已删除的文件记录
      console.log('🧹 开始清理已删除文件记录...');
      const projectService = require('./projectService');
      const cleanupResult = await projectService.cleanupDeletedFiles(projectId, projectName);
      
      if (cleanupResult.success && cleanupResult.deletedCount > 0) {
        console.log(`✅ 清理完成: ${cleanupResult.message}`);
      } else if (cleanupResult.success) {
        console.log(`📄 没有需要清理的已删除记录`);
      } else {
        console.log(`⚠️ 清理失败: ${cleanupResult.error}`);
      }
      
      // 检查是否是批量删除请求
      if (this.detectBatchDeleteQuery(userInput)) {
        console.log(`🗑️ 检测到批量删除请求`);
        console.log(`📊 批量删除请求详情:`, {
          userInput: userInput,
          projectId: projectId,
          projectName: projectName,
          timestamp: new Date().toISOString()
        });
        
        const batchResult = await this.batchDeleteAllFiles(projectId, projectName);
        
        console.log(`📊 批量删除结果:`, {
          success: batchResult.success,
          totalFiles: batchResult.success ? batchResult.data.totalFiles : 0,
          successCount: batchResult.success ? batchResult.data.successCount : 0,
          failCount: batchResult.success ? batchResult.data.failCount : 0,
          error: batchResult.success ? null : batchResult.error
        });
        
        let response = '';
        if (batchResult.success) {
          const { totalFiles, successCount, failCount, results } = batchResult.data;
          
          if (totalFiles === 0) {
            response = `📁 项目中没有找到任何文件需要删除。\n\n` +
                      `项目当前为空状态。`;
          } else if (failCount === 0) {
            response = `✅ 批量删除完成！\n\n` +
                      `📊 删除统计：\n` +
                      `- 总文件数: ${totalFiles} 个\n` +
                      `- 成功删除: ${successCount} 个\n` +
                      `- 失败: ${failCount} 个\n\n` +
                      `🎉 所有文件已成功删除！`;
          } else {
            response = `⚠️ 批量删除部分完成\n\n` +
                      `📊 删除统计：\n` +
                      `- 总文件数: ${totalFiles} 个\n` +
                      `- 成功删除: ${successCount} 个\n` +
                      `- 失败: ${failCount} 个\n\n` +
                      `❌ 失败的文件：\n`;
            
            const failedFiles = results.filter(r => r.status !== 'success');
            failedFiles.forEach(f => {
              response += `- ${f.file}: ${f.error}\n`;
            });
          }
        } else {
          console.log(`❌ 批量删除失败: ${batchResult.error}`);
          response = `❌ 批量删除失败: ${batchResult.error}\n\n` +
                    `请检查项目状态或重试操作。`;
        }
        
        // 记录对话日志
        await this.logConversation(projectId, userInput, response, []);
        
        return {
          response: response,
          actions: []
        };
      }
      
      // 检查是否是文件删除请求
      const deleteQuery = this.detectFileDeleteQuery(userInput);
      if (deleteQuery) {
        console.log(`🗑️ 检测到文件删除请求: ${deleteQuery.fileName || '需要上下文'}`);
        console.log(`📊 删除请求详情:`, {
          userInput: userInput,
          detectedFileName: deleteQuery.fileName,
          needContext: deleteQuery.needContext,
          timestamp: new Date().toISOString()
        });
        
        let fileName = deleteQuery.fileName;
        if (deleteQuery.needContext) {
          // 从上下文获取文件名（这里简化处理，实际可以从对话历史中获取）
          fileName = 'app.py'; // 临时硬编码，实际应该从上下文获取
          console.log(`⚠️ 使用默认文件名: ${fileName}`);
        }
        
        console.log(`🔍 开始查找文件: ${fileName}`);
        const fileInfo = await this.findFilePath(projectId, fileName);
        
        console.log(`📁 文件查找结果:`, {
          success: fileInfo.success,
          fileName: fileName,
          filePath: fileInfo.success ? fileInfo.data.filePath : null,
          error: fileInfo.success ? null : fileInfo.error
        });
        
        let response = '';
        if (fileInfo.success) {
          console.log(`🗑️ 开始执行删除操作:`, {
            projectId: projectId,
            fileName: fileName,
            filePath: fileInfo.data.filePath,
            projectName: projectName
          });
          
          // 执行删除操作
          const projectService = require('./projectService');
          const deleteResult = await projectService.deleteFile(projectId, fileName, fileInfo.data.filePath);
          
          console.log(`🗑️ 删除操作结果:`, {
            success: deleteResult.success,
            message: deleteResult.success ? deleteResult.message : null,
            error: deleteResult.success ? null : deleteResult.error
          });
          
          if (deleteResult.success) {
            console.log(`✅ 文件删除成功: ${fileInfo.data.filePath}`);
            response = `文件操作: 删除 ${fileInfo.data.filePath}\n\n` +
                      `已成功删除文件 "${fileName}"。\n\n` +
                      `📋 操作日志：\n` +
                      `- 时间: ${new Date().toLocaleString()}\n` +
                      `- 操作: 删除文件\n` +
                      `- 文件: ${fileInfo.data.filePath}\n` +
                      `- 状态: ✅ 成功删除\n\n` +
                      `如果您需要重新创建该文件或进行其他操作，请告诉我！`;
          } else {
            console.log(`❌ 文件删除失败: ${deleteResult.error}`);
            response = `❌ 删除文件失败: ${deleteResult.error}\n\n` +
                      `请检查文件是否存在或是否有删除权限。`;
          }
        } else {
          console.log(`❌ 文件未找到: ${fileName}`);
          response = `❌ 未找到文件 "${fileName}"，无法执行删除操作。\n\n` +
                    `请检查文件名是否正确。`;
        }
        
        // 记录对话日志
        await this.logConversation(projectId, userInput, response, []);
        
        return {
          response: response,
          actions: []
        };
      }
      
      // 检查是否是文件修改请求
      const modificationQuery = this.detectFileModificationQuery(userInput);
      if (modificationQuery) {
        console.log(`✏️ 检测到文件修改请求: ${modificationQuery.fileName || '需要上下文'}`);
        console.log(`📊 修改请求详情:`, {
          userInput: userInput,
          detectedFileName: modificationQuery.fileName,
          needContext: modificationQuery.needContext,
          timestamp: new Date().toISOString()
        });
        
        let fileName = modificationQuery.fileName;
        if (modificationQuery.needContext) {
          // 从上下文获取文件名（这里简化处理，实际可以从对话历史中获取）
          fileName = 'index.html'; // 临时硬编码，实际应该从上下文获取
          console.log(`⚠️ 使用默认文件名: ${fileName}`);
        }
        
        console.log(`🔍 开始查找文件: ${fileName}`);
        const fileInfo = await this.findFilePath(projectId, fileName);
        
        console.log(`📁 文件查找结果:`, {
          success: fileInfo.success,
          fileName: fileName,
          filePath: fileInfo.success ? fileInfo.data.filePath : null,
          error: fileInfo.success ? null : fileInfo.error
        });
        
        let response = '';
        if (fileInfo.success) {
          console.log(`✏️ 开始执行修改操作:`, {
            projectId: projectId,
            fileName: fileName,
            filePath: fileInfo.data.filePath,
            projectName: projectName
          });
          
          // 获取当前文件内容
          const projectService = require('./projectService');
          const currentFileResult = await projectService.getFileContent(projectId, projectName, fileInfo.data.filePath);
          
          if (currentFileResult.success) {
            const currentContent = currentFileResult.data.content;
            console.log(`📄 当前文件内容长度: ${currentContent ? currentContent.length : 0}`);
            
            // 调用DeepSeek API来生成新文件内容
            const modificationPrompt = `请根据用户要求创建新的文件 "${fileName}"，用户要求：${userInput}\n\n请提供完整的文件内容。`;
            
            const messages = [
              { role: 'system', content: '你是一个专业的代码助手，专门帮助用户创建和修改代码文件。' },
              { role: 'user', content: modificationPrompt }
            ];
            
            const aiResponse = await this.callDeepSeekAPI(messages);
            
            if (aiResponse) {
              console.log(`🗑️ 开始删除现有文件: ${fileInfo.data.filePath}`);
              
              // 先删除现有文件
              const deleteResult = await projectService.deleteFile(projectId, fileName, fileInfo.data.filePath);
              
              if (deleteResult.success) {
                console.log(`✅ 文件删除成功: ${fileInfo.data.filePath}`);
                
                // 再创建新文件
                console.log(`📝 开始创建新文件: ${fileName}`);
                const fileData = {
                  file_name: fileName,
                  file_type: fileName.split('.').pop() || 'txt',
                  content: aiResponse,
                  parent_path: '',
                  file_size: aiResponse.length,
                  created_by: 'ai_assistant'
                };
                const createResult = await projectService.createFile(projectId, projectName, fileData);
                
                if (createResult.success) {
                  console.log(`✅ 文件创建成功: ${fileName}`);
                  response = `文件操作: 修改 ${fileInfo.data.filePath}\n\n` +
                            `已成功修改文件 "${fileName}"。\n\n` +
                            `📋 操作日志：\n` +
                            `- 时间: ${new Date().toLocaleString()}\n` +
                            `- 操作: 删除并重新创建文件\n` +
                            `- 文件: ${fileInfo.data.filePath}\n` +
                            `- 状态: ✅ 成功修改\n\n` +
                            `文件内容已根据您的要求完全替换。`;
                } else {
                  console.log(`❌ 文件创建失败: ${createResult.error}`);
                  response = `❌ 文件创建失败: ${createResult.error}\n\n` +
                            `文件已删除但创建失败，请重试。`;
                }
              } else {
                console.log(`❌ 文件删除失败: ${deleteResult.error}`);
                response = `❌ 文件删除失败: ${deleteResult.error}\n\n` +
                          `无法删除现有文件，修改操作失败。`;
              }
            } else {
              console.log(`❌ AI生成新内容失败`);
              response = `❌ 无法生成新文件内容\n\n` +
                        `请重新描述您的修改要求。`;
            }
          } else {
            console.log(`❌ 无法获取文件内容: ${currentFileResult.error}`);
            response = `❌ 无法获取文件内容: ${currentFileResult.error}\n\n` +
                      `请检查文件是否存在。`;
          }
        } else {
          console.log(`📝 文件不存在，将创建新文件: ${fileName}`);
          
          // 文件不存在时，创建新文件
          const projectService = require('./projectService');
          
          // 调用DeepSeek API来创建文件内容
          const creationPrompt = `请创建文件 "${fileName}"，用户要求：${userInput}\n\n请提供完整的文件内容。`;
          
          const messages = [
            { role: 'system', content: '你是一个专业的代码助手，专门帮助用户创建和修改代码文件。' },
            { role: 'user', content: creationPrompt }
          ];
          
          const aiResponse = await this.callDeepSeekAPI(messages);
          
          if (aiResponse) {
            // 修复路径处理：正确分离文件名和父路径
            let actualFileName = fileName;
            let parentPath = '';
            
            if (fileName.includes('/')) {
              const pathParts = fileName.split('/');
              actualFileName = pathParts.pop(); // 最后一部分是文件名
              parentPath = pathParts.join('/'); // 前面的部分是父路径
            }
            
            // 创建文件
            const fileData = {
              file_name: actualFileName, // 只使用实际文件名
              file_type: actualFileName.split('.').pop() || 'txt',
              content: aiResponse,
              parent_path: parentPath, // 正确设置父路径
              file_size: aiResponse.length,
              created_by: 'ai_assistant'
            };
            const createResult = await projectService.createFile(projectId, projectName, fileData);
            
            if (createResult.success) {
              console.log(`✅ 文件创建成功: ${fileName}`);
              response = `文件操作: 创建 ${fileName}\n\n` +
                        `已成功创建文件 "${fileName}"。\n\n` +
                        `📋 操作日志：\n` +
                        `- 时间: ${new Date().toLocaleString()}\n` +
                        `- 操作: 创建文件\n` +
                        `- 文件: ${fileName}\n` +
                        `- 状态: ✅ 成功创建\n\n` +
                        `文件内容已根据您的要求进行创建。`;
            } else {
              console.log(`❌ 文件创建失败: ${createResult.error}`);
              response = `❌ 创建文件失败: ${createResult.error}\n\n` +
                        `请检查文件权限或重试操作。`;
            }
          } else {
            console.log(`❌ AI创建建议失败`);
            response = `❌ 无法生成文件内容\n\n` +
                      `请重新描述您的文件创建要求。`;
          }
        }
        
        // 记录对话日志
        await this.logConversation(projectId, userInput, response, []);
        
        return {
          response: response,
          actions: []
        };
      }
      
      // 检查是否是文件结构查询请求
      if (this.detectFileStructureQuery(userInput)) {
        console.log(`🌳 检测到文件结构查询请求`);
        console.log(`📊 文件结构查询详情:`, {
          userInput: userInput,
          projectId: projectId,
          projectName: projectName,
          timestamp: new Date().toISOString()
        });
        
        const fileStructure = await this.getProjectFileStructure(projectId);
        
        console.log(`📁 文件结构获取结果:`, {
          success: fileStructure.success,
          error: fileStructure.success ? null : fileStructure.error,
          hasData: fileStructure.success && fileStructure.data ? true : false,
          projectName: fileStructure.success ? fileStructure.data.projectName : null,
          totalItems: fileStructure.success ? fileStructure.data.totalItems : 0
        });
        
        let response = '';
        if (fileStructure.success) {
          const treeText = this.formatFileStructure(fileStructure.data.fileTree);
          console.log(`🌳 格式化文件树:`, {
            treeTextLength: treeText.length,
            treeText: treeText
          });
          
          response = `📁 项目 "${fileStructure.data.projectName}" 的文件结构：\n\n` +
                    `${treeText}\n` +
                    `📊 统计信息：\n` +
                    `- 总项目数: ${fileStructure.data.totalItems} 个\n` +
                    `- 项目ID: ${projectId}\n\n` +
                    `💡 提示：您可以使用以下命令操作文件：\n` +
                    `- "删除 [文件名]" - 删除指定文件\n` +
                    `- "[文件名]的路径" - 查看文件路径\n` +
                    `- "创建文件 [文件名]" - 创建新文件`;
          
          console.log(`✅ 文件结构查询成功，响应长度: ${response.length} 字符`);
        } else {
          console.log(`❌ 获取项目文件结构失败: ${fileStructure.error}`);
          response = `❌ 获取项目文件结构失败: ${fileStructure.error}\n\n` +
                    `请检查项目是否存在或数据库连接是否正常。`;
        }
        
        // 记录对话日志
        await this.logConversation(projectId, userInput, response, []);
        
        return {
          response: response,
          actions: []
        };
      }
      
      // 检查是否是文件路径查询请求
      const filePathQuery = this.detectFilePathQuery(userInput);
      if (filePathQuery) {
        console.log(`🔍 检测到文件路径查询: ${filePathQuery.fileName}`);
        const fileInfo = await this.findFilePath(projectId, filePathQuery.fileName);
        
        let response = '';
        if (fileInfo.success) {
          response = `文件 "${fileInfo.data.fileName}" 的完整路径信息：\n\n` +
                    `📁 文件路径: ${fileInfo.data.filePath}\n` +
                    `📂 父目录: ${fileInfo.data.parentPath || '根目录'}\n` +
                    `📄 文件类型: ${fileInfo.data.fileType || '未知'}\n` +
                    `📊 文件大小: ${fileInfo.data.fileSize || '未知'} 字节\n\n` +
                    `该文件位于项目的 ${fileInfo.data.parentPath ? fileInfo.data.parentPath + '/' : ''}${fileInfo.data.fileName}`;
        } else {
          response = `抱歉，在项目中未找到文件 "${filePathQuery.fileName}"。\n\n` +
                    `请检查文件名是否正确，或者告诉我您想要查找的其他文件。`;
        }
        
        // 记录对话日志
        await this.logConversation(projectId, userInput, response, []);
        
        return {
          response: response,
          actions: []
        };
      }
      
      // 构建消息
      const systemPrompt = this.buildSystemPrompt(
        projectId, 
        projectName,
        projectType,
        context ? context.previousMessages : null
      );
      
      const userMessage = this.buildUserMessage(userInput, context);
      
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ];
      
      // 调用DeepSeek API
      const aiResponse = await this.callDeepSeekAPI(messages);
      
      // 解析AI响应，提取操作信息
      const parsedResponse = this.parseAIResponse(aiResponse);
      
      // 记录对话日志
      await this.logConversation(projectId, userInput, aiResponse, parsedResponse.actions);
      
      return {
        response: parsedResponse.content,
        actions: parsedResponse.actions
      };
    } catch (error) {
      console.error('❌ 处理AI对话失败:', error);
      throw error;
    }
  }

  // 解析AI响应
  parseAIResponse(response) {
    const actions = [];
    let content = response;
    
    // 提取代码修改操作
    const codeBlocks = response.match(/```(\w+)?\n([\s\S]*?)```/g);
    if (codeBlocks) {
      // 提取所有文件操作描述
      const fileOperations = response.match(/创建文件[：:]\s*(.+)/g) || [];
      
      codeBlocks.forEach((block, index) => {
        const language = block.match(/```(\w+)?/)[1] || 'javascript';
        const code = block.replace(/```(\w+)?\n/, '').replace(/```$/, '');
        
        // 智能匹配文件名
        let fileName;
        
        // 首先尝试从对应的文件操作描述中获取
        if (fileOperations[index]) {
          fileName = fileOperations[index].replace(/创建文件[：:]\s*/, '');
        } else {
          // 如果找不到对应的描述，尝试从代码内容中推断文件名
          if (language === 'json' && code.includes('"name"')) {
            const nameMatch = code.match(/"name":\s*"([^"]+)"/);
            fileName = nameMatch ? `${nameMatch[1]}.json` : 'package.json';
          } else if (language === 'javascript' && code.includes('createApp')) {
            fileName = 'main.js';
          } else if (language === 'vue') {
            fileName = 'App.vue';
          } else if (language === 'bash') {
            fileName = 'run.sh';
          } else {
            fileName = `ai_generated_${Date.now()}_${index}.${this.getFileExtension(language)}`;
          }
        }
        
        actions.push({
          id: `action_${Date.now()}_${index}`,
          type: 'code_modification',
          description: `创建文件: ${fileName}`,
          language: language,
          code: code,
          timestamp: new Date()
        });
      });
    }
    
    // 提取文件操作
    const fileOperations = response.match(/文件操作[：:]\s*(.+)/g);
    if (fileOperations) {
      fileOperations.forEach((operation, index) => {
        const description = operation.replace(/文件操作[：:]\s*/, '');
        
        // 检查是否有对应的代码块
        const codeBlockMatch = response.match(/```(\w+)?\n([\s\S]*?)```/);
        let code = '';
        let language = 'text';
        
        if (codeBlockMatch) {
          language = codeBlockMatch[1] || 'text';
          code = codeBlockMatch[2] || '';
        }
        
        actions.push({
          id: `file_${Date.now()}_${index}`,
          type: 'file_operation',
          description: description,
          code: code,
          language: language,
          timestamp: new Date()
        });
      });
    }
    
    return {
      content: content,
      actions: actions
    };
  }

  // 记录对话日志
  async logConversation(projectId, userInput, aiResponse, actions) {
    try {
      console.log('📝 记录对话日志...');
      
      const [result] = await pool.execute(
        `INSERT INTO ai_conversations 
         (project_id, user_id, user_message, ai_response, context)
         VALUES (?, ?, ?, ?, ?)`,
        [
          projectId,
          1, // 使用默认用户ID 1
          userInput,
          aiResponse,
          JSON.stringify({ actions })
        ]
      );
      
      console.log(`✅ 对话日志记录成功，ID: ${result.insertId}`);
      return result.insertId;
    } catch (error) {
      console.error('❌ 记录对话日志失败:', error);
      throw error;
    }
  }

  // 获取项目文件结构
  async getProjectStructure(folderPath) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM folder_info WHERE folder_path = ?',
        [folderPath]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      const folderInfo = rows[0];
      const [files] = await pool.execute(
        `SELECT * FROM \`${folderInfo.table_name}\` ORDER BY level, name`
      );
      
      return {
        folderInfo: folderInfo,
        files: files
      };
    } catch (error) {
      console.error('❌ 获取项目结构失败:', error);
      throw error;
    }
  }

  // 获取操作历史
  async getOperationHistory(folderPath, limit = 10) {
    try {
      const [rows] = await pool.execute(
        `SELECT * FROM ai_conversations 
         WHERE folder_path = ? 
         ORDER BY created_at DESC 
         LIMIT ?`,
        [folderPath, limit]
      );
      
      return rows;
    } catch (error) {
      console.error('❌ 获取操作历史失败:', error);
      throw error;
    }
  }

  // 执行代码修改
  async executeCodeModification(action, projectId, projectName) {
    try {
      console.log(`🔧 执行代码修改: ${action.description}`);
      
      if (action.type === 'code_modification') {
        // 解析文件名和路径
        const fileName = this.extractFileName(action.description, action.language);
        
        // 修复路径重复问题：正确处理文件路径
        let actualFileName, parentPath;
        if (fileName.includes('/')) {
          // 如果文件名包含路径，分离文件名和父路径
          const pathParts = fileName.split('/');
          actualFileName = pathParts.pop(); // 最后一部分是文件名
          parentPath = pathParts.join('/'); // 前面的部分是父路径
        } else {
          // 如果只是文件名，直接使用
          actualFileName = fileName;
          parentPath = '';
        }
        
        console.log(`📝 准备创建/修改文件: ${actualFileName}`);
        console.log(`📝 文件名: ${actualFileName}`);
        console.log(`📝 父路径: ${parentPath}`);
        console.log(`📝 代码内容: ${action.language}`);
        
        // 保存文件到项目数据库
        const fileData = {
          file_name: actualFileName, // 只使用实际文件名
          file_type: path.extname(actualFileName).substring(1) || 'txt',
          file_size: action.code.length,
          content: action.code,
          is_directory: false,
          parent_path: parentPath,
          depth: parentPath ? parentPath.split('/').length : 0,
          created_by: 'ai_assistant'
        };
        
        // 使用项目服务保存文件
        const projectService = require('./projectService');
        const saveResult = await projectService.createFile(projectId, projectName, fileData);
        
        if (saveResult.success) {
          console.log(`✅ 文件保存到项目成功: ${filePath}`);
          
          // 记录修改操作
          await this.logCodeModification(action, projectId);
          
          // 记录项目活动日志
          await projectService.logProjectActivity(projectId, 1, 'file_created', {
            fileName,
            filePath,
            language: action.language,
            size: action.code.length,
            description: action.description
          });
        } else {
          throw new Error(`保存文件失败: ${saveResult.error}`);
        }
      } else if (action.type === 'file_operation') {
        // 处理文件操作（删除、重命名等）
        await this.executeFileOperation(action, projectId, projectName);
      }
      
      return true;
    } catch (error) {
      console.error('❌ 执行代码修改失败:', error);
      throw error;
    }
  }

  // 执行文件操作
  async executeFileOperation(action, projectId, projectName) {
    try {
      console.log(`🔧 执行文件操作: ${action.description}`);
      
      // 解析操作类型和文件名
      const operationMatch = action.description.match(/^(删除|修改|重命名)\s+(.+)$/);
      if (!operationMatch) {
        console.log(`⚠️ 无法解析文件操作: ${action.description}`);
        return;
      }
      
      const operationType = operationMatch[1];
      const fileName = operationMatch[2];
      const filePath = `/${fileName}`;
      
      console.log(`📝 文件操作: ${operationType} - ${filePath}`);
      
      const projectService = require('./projectService');
      
      switch (operationType) {
        case '删除':
          // 实际删除文件
          try {
            // 如果filePath不完整，尝试查找文件的实际路径
            let actualFilePath = filePath;
            if (!filePath || filePath === `/${fileName}`) {
              console.log(`🔍 查找文件实际路径: ${fileName}`);
              const project = await projectService.getProject(projectId);
              if (project.success) {
                const projectName = project.data.name;
                const fileTree = await projectService.getProjectFileTree(projectId, projectName);
                if (fileTree.success) {
                  const foundFile = this.findFileInTree(fileTree.data, fileName);
                  if (foundFile) {
                    actualFilePath = foundFile.file_path;
                    console.log(`✅ 找到文件路径: ${actualFilePath}`);
                  }
                }
              }
            }
            
            const deleteResult = await projectService.deleteFile(projectId, fileName, actualFilePath);
            if (deleteResult.success) {
              console.log(`✅ 文件删除成功: ${actualFilePath}`);
              // 记录删除操作到项目日志
              await projectService.logProjectActivity(projectId, 1, 'file_deleted', {
                fileName,
                filePath: actualFilePath,
                operationType: 'delete',
                description: action.description
              });
            } else {
              console.log(`❌ 文件删除失败: ${deleteResult.error}`);
            }
          } catch (error) {
            console.error(`❌ 文件删除操作失败:`, error);
          }
          break;
          
        case '修改':
          // 修改文件内容（如果有代码内容）
          if (action.code) {
            console.log(`📝 开始修改文件内容: ${filePath}`);
            console.log(`📊 修改数据:`, {
              projectId: projectId,
              projectName: projectName,
              filePath: filePath,
              contentLength: action.code.length,
              fileName: fileName
            });
            
            const updateResult = await projectService.updateFileContent(projectId, projectName, filePath, action.code);
            
            if (updateResult.success) {
              console.log(`✅ 文件修改保存成功: ${filePath}`);
              
              await projectService.logProjectActivity(projectId, 1, 'file_modified', {
                fileName,
                filePath,
                operationType: 'modify',
                size: action.code.length,
                description: action.description
              });
            } else {
              throw new Error(`保存文件修改失败: ${updateResult.error}`);
            }
          }
          break;
          
        default:
          console.log(`⚠️ 不支持的操作类型: ${operationType}`);
      }
      
    } catch (error) {
      console.error('❌ 执行文件操作失败:', error);
      throw error;
    }
  }

  // 从描述中提取文件名
  extractFileName(description, language) {
    // 尝试从描述中提取文件名
    const fileNameMatch = description.match(/创建文件[：:]\s*(.+)/);
    if (fileNameMatch) {
      return fileNameMatch[1];
    }
    
    // 如果没有明确指定，生成默认文件名
    const timestamp = Date.now();
    const extension = this.getFileExtension(language);
    return `ai_generated_${timestamp}.${extension}`;
  }

  // 根据语言获取文件扩展名
  getFileExtension(language) {
    const extensions = {
      'javascript': 'js',
      'js': 'js',
      'typescript': 'ts',
      'ts': 'ts',
      'python': 'py',
      'py': 'py',
      'java': 'java',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'xml': 'xml',
      'sql': 'sql',
      'php': 'php',
      'c': 'c',
      'cpp': 'cpp',
      'csharp': 'cs',
      'cs': 'cs',
      'go': 'go',
      'rust': 'rs',
      'ruby': 'rb',
      'rb': 'rb'
    };
    
    return extensions[language.toLowerCase()] || 'txt';
  }

  // 记录文件操作日志
  async logFileOperation(folderPath, actionType, message, details) {
    try {
      // 获取文件夹ID
      const [folderRows] = await pool.execute(
        'SELECT id FROM folder_info WHERE folder_path = ?',
        [folderPath]
      );
      
      if (folderRows.length > 0) {
        const folderId = folderRows[0].id;
        
        const [result] = await pool.execute(
          `INSERT INTO processing_logs 
           (folder_id, action_type, status, message, details)
           VALUES (?, ?, 'completed', ?, ?)`,
          [folderId, actionType, message, JSON.stringify(details)]
        );
        
        console.log(`✅ 文件操作日志记录成功，ID: ${result.insertId}`);
      }
    } catch (error) {
      console.error('❌ 记录文件操作日志失败:', error);
    }
  }

  // 记录代码修改
  async logCodeModification(action, projectId) {
    try {
      const [result] = await pool.execute(
        `INSERT INTO code_modifications 
         (project_id, user_id, file_path, action, content, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          1, // 使用默认用户ID 1
          action.filePath || '',
          action.type === 'code_modification' ? 'create' : 'modify',
          action.code || '',
          action.description
        ]
      );
      
      console.log(`✅ 代码修改记录成功，ID: ${result.insertId}`);
      return result.insertId;
    } catch (error) {
      console.error('❌ 记录代码修改失败:', error);
      throw error;
    }
  }

  // 获取项目AI对话
  async getProjectAIChats(projectId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM ai_conversations WHERE project_id = ? ORDER BY created_at DESC',
        [projectId]
      );
      
      return {
        success: true,
        data: rows
      };
    } catch (error) {
      console.error('❌ 获取项目AI对话失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 获取统计信息
  async getAIStats(folderPath) {
    try {
      const [conversationCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM ai_conversations WHERE project_id = ?',
        [folderPath]
      );
      
      const [modificationCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM code_modifications WHERE project_id = ?',
        [folderPath]
      );
      
      return {
        conversationCount: conversationCount[0].count,
        modificationCount: modificationCount[0].count
      };
    } catch (error) {
      console.error('❌ 获取AI统计信息失败:', error);
      throw error;
    }
  }

  // 在文件树中查找文件
  findFileInTree(fileTree, fileName) {
    for (const item of fileTree) {
      if (item.file_name === fileName) {
        return item;
      }
      if (item.children && item.children.length > 0) {
        const found = this.findFileInTree(item.children, fileName);
        if (found) return found;
      }
    }
    return null;
  }

  // 获取项目文件结构
  async getProjectFileStructure(projectId) {
    try {
      console.log(`🌳 获取项目文件结构: ${projectId}`);
      
      const projectService = require('./projectService');
      const project = await projectService.getProject(projectId);
      
      console.log(`📊 项目基本信息:`, {
        projectId: projectId,
        projectExists: project.success,
        projectData: project.success ? {
          id: project.data.id,
          name: project.data.name,
          description: project.data.description,
          type: project.data.type,
          created_by: project.data.created_by,
          created_by_id: project.data.created_by_id,
          members: project.data.members,
          member_ids: project.data.member_ids,
          settings: project.data.settings
        } : null
      });
      
      if (!project.success) {
        console.log(`❌ 项目不存在: ${projectId}`);
        return { success: false, error: '项目不存在' };
      }
      
      const projectName = project.data.name;
      console.log(`📁 项目名称: ${projectName}`);
      
      const fileTree = await projectService.getProjectFileTree(projectId, projectName);
      
      console.log(`🌳 文件树数据:`, {
        success: fileTree.success,
        dataLength: fileTree.success ? fileTree.data.length : 0,
        fileTree: fileTree.success ? fileTree.data : null
      });
      
      if (!fileTree.success) {
        console.log(`❌ 获取文件树失败: ${fileTree.error}`);
        return { success: false, error: '获取文件树失败' };
      }
      
      const totalItems = this.countItemsInTree(fileTree.data);
      console.log(`📊 文件统计:`, {
        totalItems: totalItems,
        rootItems: fileTree.data.length,
        fileTreeStructure: this.formatFileStructure(fileTree.data)
      });
      
      return {
        success: true,
        data: {
          projectName,
          fileTree: fileTree.data,
          totalItems: this.countItemsInTree(fileTree.data)
        }
      };
    } catch (error) {
      console.error('❌ 获取项目文件结构失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 查找文件路径
  async findFilePath(projectId, fileName) {
    try {
      console.log(`🔍 查找文件路径: ${fileName}`);
      console.log(`📊 查找参数:`, {
        projectId: projectId,
        fileName: fileName,
        timestamp: new Date().toISOString()
      });
      
      const fileStructure = await this.getProjectFileStructure(projectId);
      
      console.log(`📁 文件结构获取结果:`, {
        success: fileStructure.success,
        error: fileStructure.success ? null : fileStructure.error,
        hasData: fileStructure.success && fileStructure.data ? true : false
      });
      
      if (!fileStructure.success) {
        console.log(`❌ 获取文件结构失败: ${fileStructure.error}`);
        return { success: false, error: fileStructure.error };
      }
      
      console.log(`🔍 开始搜索文件: ${fileName}`);
      console.log(`📂 搜索范围:`, {
        totalItems: fileStructure.data.totalItems,
        rootItems: fileStructure.data.fileTree.length,
        searchTarget: fileName
      });
      
      const foundFile = this.findFileInTree(fileStructure.data.fileTree, fileName);
      
      console.log(`🎯 搜索结果:`, {
        found: foundFile ? true : false,
        fileInfo: foundFile ? {
          fileName: foundFile.file_name,
          filePath: foundFile.file_path,
          fileType: foundFile.file_type,
          fileSize: foundFile.file_size,
          parentPath: foundFile.parent_path,
          itemType: foundFile.item_type,
          status: foundFile.status
        } : null
      });
      
      if (foundFile) {
        console.log(`✅ 文件找到: ${foundFile.file_path}`);
        return {
          success: true,
          data: {
            fileName: foundFile.file_name,
            filePath: foundFile.file_path,
            fileType: foundFile.file_type,
            fileSize: foundFile.file_size,
            parentPath: foundFile.parent_path
          }
        };
      }
      
      console.log(`❌ 文件未找到: ${fileName}`);
      return { success: false, error: '文件不存在' };
    } catch (error) {
      console.error('❌ 查找文件路径失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 统计文件树中的项目数量
  countItemsInTree(fileTree) {
    let count = 0;
    for (const item of fileTree) {
      count++;
      if (item.children && item.children.length > 0) {
        count += this.countItemsInTree(item.children);
      }
    }
    return count;
  }

  // 检测文件路径查询请求
  detectFilePathQuery(userInput) {
    const patterns = [
      /(.+?)的完整路径是什么/i,
      /(.+?)的路径是什么/i,
      /(.+?)在哪里/i,
      /(.+?)的路径/i,
      /(.+?)的完整路径/i,
      /(.+?)路径/i
    ];
    
    for (const pattern of patterns) {
      const match = userInput.match(pattern);
      if (match) {
        const fileName = match[1].trim();
        // 提取文件名（去掉可能的引号）
        const cleanFileName = fileName.replace(/['"]/g, '');
        return { fileName: cleanFileName };
      }
    }
    
    return null;
  }

  // 检测文件删除请求
  detectFileDeleteQuery(userInput) {
    const patterns = [
      /删除(.+?)$/i,
      /删除文件(.+?)$/i,
      /删除这个文件/i,
      /删除该文件/i,
      /删除(.+?)文件/i,
      /删除(.+?)文件夹/i,
      /删除(.+?)目录/i,
      /删除(.+?)夹/i
    ];
    
    for (const pattern of patterns) {
      const match = userInput.match(pattern);
      if (match) {
        let fileName = match[1] ? match[1].trim() : '';
        // 如果是"删除这个文件"或"删除该文件"，需要从上下文获取文件名
        if (!fileName || fileName === '这个' || fileName === '该') {
          return { fileName: null, needContext: true };
        }
        
        // 处理文件夹名称的特殊情况
        if (fileName.includes('文件夹')) {
          fileName = fileName.replace(/文件夹/g, '').trim();
        }
        if (fileName.includes('目录')) {
          fileName = fileName.replace(/目录/g, '').trim();
        }
        if (fileName.includes('夹')) {
          fileName = fileName.replace(/夹/g, '').trim();
        }
        
        // 提取文件名（去掉可能的引号）
        const cleanFileName = fileName.replace(/['"]/g, '');
        console.log(`🔍 文件名清理: "${match[1]}" -> "${cleanFileName}"`);
        return { fileName: cleanFileName, needContext: false };
      }
    }
    
    return null;
  }

  // 检测文件修改请求
  detectFileModificationQuery(userInput) {
    const patterns = [
      /修改\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s*/i,
      /修改文件\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s*/i,
      /修改这个文件/i,
      /修改该文件/i,
      /修改\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s+文件/i,
      /更新\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s*/i,
      /更新文件\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s*/i,
      /更新这个文件/i,
      /更新该文件/i,
      /更新\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s+文件/i,
      /编辑\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s*/i,
      /编辑文件\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s*/i,
      /编辑这个文件/i,
      /编辑该文件/i,
      /编辑\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s+文件/i,
      /优化\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s*/i,
      /优化文件\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s*/i,
      /优化\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s+文件/i,
      /美化\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s*/i,
      /美化文件\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s*/i,
      /美化\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s+文件/i,
      /改进\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s*/i,
      /改进文件\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s*/i,
      /改进\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s+文件/i,
      // 新增模式：匹配"把xxx改成xxx"的表达方式
      /把\s*([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))改成/i,
      /把\s*([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))改为/i,
      /把\s*([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))变成/i,
      /把\s*([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))做成/i,
      // 匹配"让xxx变成xxx"的表达方式
      /让\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s+变成/i,
      /让\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s+改成/i,
      /让\s+([a-zA-Z0-9_\-\.]+\.(html|css|js|vue|ts|jsx|tsx|json|md|txt|py|java|cpp|c|php|go|rs|rb|swift|kt|scala|sh|bat|sql|xml|yaml|yml))\s+改为/i
    ];
    
    for (const pattern of patterns) {
      const match = userInput.match(pattern);
      if (match) {
        let fileName = match[1] ? match[1].trim() : '';
        // 如果是"修改这个文件"或"修改该文件"，需要从上下文获取文件名
        if (!fileName || fileName === '这个' || fileName === '该') {
          return { fileName: null, needContext: true };
        }
        
        // 提取文件名（去掉可能的引号）
        const cleanFileName = fileName.replace(/['"]/g, '');
        console.log(`🔍 检测到修改请求: "${cleanFileName}"`);
        return { fileName: cleanFileName, needContext: false };
      }
    }
    
    return null;
  }

  // 检测批量删除请求
  detectBatchDeleteQuery(userInput) {
    const patterns = [
      /删除项目所有文件/i,
      /删除所有文件/i,
      /清空项目/i,
      /删除项目所有文件和文件夹/i,
      /清空所有文件/i,
      /删除全部文件/i
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(userInput)) {
        return true;
      }
    }
    
    return false;
  }

  // 批量删除项目中的所有文件和文件夹
  async batchDeleteAllFiles(projectId, projectName) {
    try {
      console.log(`🗑️ 开始批量删除项目所有文件: ${projectId}`);
      
      const projectService = require('./projectService');
      const fileStructure = await this.getProjectFileStructure(projectId);
      
      if (!fileStructure.success) {
        return { success: false, error: '获取项目文件结构失败' };
      }
      
      const allFiles = this.getAllFilesFromTree(fileStructure.data.fileTree);
      console.log(`📊 找到 ${allFiles.length} 个文件需要删除:`, allFiles.map(f => f.file_path));
      
      let successCount = 0;
      let failCount = 0;
      const results = [];
      
      for (const file of allFiles) {
        try {
          const deleteResult = await projectService.deleteFile(projectId, file.file_name, file.file_path);
          if (deleteResult.success) {
            successCount++;
            results.push({ file: file.file_path, status: 'success' });
            console.log(`✅ 删除成功: ${file.file_path}`);
          } else {
            failCount++;
            results.push({ file: file.file_path, status: 'failed', error: deleteResult.error });
            console.log(`❌ 删除失败: ${file.file_path} - ${deleteResult.error}`);
          }
        } catch (error) {
          failCount++;
          results.push({ file: file.file_path, status: 'error', error: error.message });
          console.log(`❌ 删除出错: ${file.file_path} - ${error.message}`);
        }
      }
      
      console.log(`📊 批量删除完成: 成功 ${successCount} 个, 失败 ${failCount} 个`);
      
      return {
        success: true,
        data: {
          totalFiles: allFiles.length,
          successCount,
          failCount,
          results
        }
      };
    } catch (error) {
      console.error('❌ 批量删除失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 从文件树中提取所有文件
  getAllFilesFromTree(fileTree) {
    let allFiles = [];
    
    for (const item of fileTree) {
      if (item.item_type === 'file') {
        allFiles.push(item);
      }
      if (item.children && item.children.length > 0) {
        allFiles = allFiles.concat(this.getAllFilesFromTree(item.children));
      }
    }
    
    return allFiles;
  }
  detectFileStructureQuery(userInput) {
    const patterns = [
      /文件结构给我/i,
      /项目结构给我/i,
      /显示文件结构/i,
      /显示项目结构/i,
      /文件树给我/i,
      /项目文件结构/i,
      /文件列表给我/i,
      /项目文件列表/i,
      /返回文件结构/i,
      /返回项目结构/i,
      /查看文件结构/i,
      /查看项目结构/i,
      /文件结构/i,
      /项目结构/i
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(userInput)) {
        return true;
      }
    }
    
    return false;
  }

  // 格式化文件结构为树形文本
  formatFileStructure(fileTree, indent = '') {
    let result = '';
    for (const item of fileTree) {
      const icon = item.item_type === 'folder' ? '📁' : '📄';
      const size = item.file_size ? ` (${item.file_size} 字节)` : '';
      result += `${indent}${icon} ${item.file_name}${size}\n`;
      
      if (item.children && item.children.length > 0) {
        result += this.formatFileStructure(item.children, indent + '  ');
      }
    }
    return result;
  }
}

module.exports = new AIService();

const mysql = require('mysql2/promise');

// 测试数据库连接
async function testDatabaseConnection() {
  console.log('🔍 开始测试数据库连接...');
  console.log('📍 目标服务器: 39.108.142.250:3306');
  console.log('👤 用户名: wslop');
  console.log('🗄️ 数据库: autoai');
  console.log('');

  const config = {
    host: '39.108.142.250',
    user: 'wslop',
    password: '345345',
    database: 'autoai',
    port: 3306,
    charset: 'utf8mb4',
    timezone: '+08:00',
    connectionLimit: 1,
    acquireTimeout: 10000,
    connectTimeout: 10000
  };

  try {
    console.log('⏳ 正在尝试连接...');
    const connection = await mysql.createConnection(config);
    
    console.log('✅ 数据库连接成功!');
    console.log('📍 连接信息:', {
      host: connection.config.host,
      port: connection.config.port,
      user: connection.config.user,
      database: connection.config.database
    });

    // 测试查询
    console.log('🔍 测试查询...');
    const [rows] = await connection.execute('SELECT VERSION() as version, NOW() as current_time');
    console.log('📊 查询结果:', rows[0]);

    // 检查表是否存在
    console.log('🔍 检查表结构...');
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('📋 现有表:', tables.map(row => Object.values(row)[0]));

    await connection.end();
    console.log('🎉 测试完成，连接正常!');
    return true;

  } catch (error) {
    console.error('❌ 数据库连接失败:');
    console.error('错误类型:', error.code);
    console.error('错误信息:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 建议: 检查MySQL服务是否启动');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('💡 建议: 检查防火墙和网络连接');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('💡 建议: 检查用户名和密码');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('💡 建议: 数据库不存在，需要先创建');
    }
    
    return false;
  }
}

// 执行测试
testDatabaseConnection().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ 测试过程出错:', error);
  process.exit(1);
});

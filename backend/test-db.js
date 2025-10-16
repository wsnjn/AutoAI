const mysql = require('mysql2/promise');

async function testDatabase() {
  console.log('🔍 测试数据库连接...');
  
  const configs = [
    { host: '127.0.0.1', name: 'IPv4 localhost' },
    { host: 'localhost', name: 'localhost' },
    { host: '::1', name: 'IPv6 localhost' }
  ];
  
  for (const config of configs) {
    try {
      console.log(`\n📡 尝试连接 ${config.name} (${config.host})...`);
      
      const connection = await mysql.createConnection({
        host: config.host,
        user: 'wslop',
        password: '345345',
        port: 3306,
        connectTimeout: 5000
      });
      
      console.log(`✅ ${config.name} 连接成功!`);
      
      // 测试查询
      const [rows] = await connection.execute('SELECT VERSION() as version, NOW() as current_time');
      console.log(`📊 MySQL 版本: ${rows[0].version}`);
      console.log(`⏰ 当前时间: ${rows[0].current_time}`);
      
      await connection.end();
      
    } catch (error) {
      console.log(`❌ ${config.name} 连接失败: ${error.message}`);
    }
  }
  
  // 测试数据库是否存在
  try {
    console.log('\n🔍 检查 autoai 数据库...');
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'wslop',
      password: '345345',
      port: 3306
    });
    
    const [databases] = await connection.execute('SHOW DATABASES');
    const dbExists = databases.some(db => db.Database === 'autoai');
    
    if (dbExists) {
      console.log('✅ autoai 数据库已存在');
    } else {
      console.log('❌ autoai 数据库不存在，需要创建');
    }
    
    await connection.end();
    
  } catch (error) {
    console.log(`❌ 检查数据库失败: ${error.message}`);
  }
}

testDatabase().catch(console.error);

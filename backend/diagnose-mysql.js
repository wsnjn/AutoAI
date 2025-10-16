const mysql = require('mysql2/promise');
const net = require('net');

// 诊断MySQL连接问题
async function diagnoseMySQL() {
  console.log('🔍 MySQL连接诊断开始...');
  console.log('📍 目标服务器: 39.108.142.250:3306');
  console.log('');

  // 1. 测试端口连通性
  console.log('1️⃣ 测试端口连通性...');
  await testPortConnection();

  // 2. 测试MySQL连接（不指定数据库）
  console.log('\n2️⃣ 测试MySQL连接（不指定数据库）...');
  await testMySQLConnection(false);

  // 3. 测试MySQL连接（指定数据库）
  console.log('\n3️⃣ 测试MySQL连接（指定数据库）...');
  await testMySQLConnection(true);

  // 4. 测试不同用户
  console.log('\n4️⃣ 测试root用户连接...');
  await testRootConnection();
}

// 测试端口连通性
function testPortConnection() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 5000;

    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      console.log('✅ 端口3306连接成功');
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      console.log('❌ 端口3306连接超时');
      socket.destroy();
      resolve(false);
    });

    socket.on('error', (err) => {
      console.log('❌ 端口3306连接失败:', err.message);
      resolve(false);
    });

    socket.connect(3306, '39.108.142.250');
  });
}

// 测试MySQL连接
async function testMySQLConnection(withDatabase) {
  const config = {
    host: '39.108.142.250',
    user: 'wslop',
    password: '345345',
    port: 3306,
    charset: 'utf8mb4',
    connectTimeout: 10000
  };

  if (withDatabase) {
    config.database = 'autoai';
  }

  try {
    console.log(`⏳ 尝试连接${withDatabase ? '（指定数据库）' : '（不指定数据库）'}...`);
    const connection = await mysql.createConnection(config);
    
    console.log('✅ MySQL连接成功!');
    
    // 测试查询
    const [rows] = await connection.execute('SELECT VERSION() as version, USER() as user, DATABASE() as database');
    console.log('📊 连接信息:', rows[0]);

    await connection.end();
    return true;

  } catch (error) {
    console.log('❌ MySQL连接失败:');
    console.log('   错误代码:', error.code);
    console.log('   错误信息:', error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('💡 用户名或密码错误');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('💡 数据库不存在');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('💡 连接超时，可能是MySQL服务未启动或配置问题');
    }
    
    return false;
  }
}

// 测试root用户连接
async function testRootConnection() {
  const config = {
    host: '39.108.142.250',
    user: 'root',
    password: '345345',
    port: 3306,
    charset: 'utf8mb4',
    connectTimeout: 10000
  };

  try {
    console.log('⏳ 尝试root用户连接...');
    const connection = await mysql.createConnection(config);
    
    console.log('✅ Root用户连接成功!');
    
    // 检查用户权限
    const [users] = await connection.execute("SELECT user, host FROM mysql.user WHERE user IN ('wslop', 'root')");
    console.log('👥 用户权限:', users);

    await connection.end();
    return true;

  } catch (error) {
    console.log('❌ Root用户连接失败:');
    console.log('   错误代码:', error.code);
    console.log('   错误信息:', error.message);
    return false;
  }
}

// 执行诊断
diagnoseMySQL().then(() => {
  console.log('\n🎯 诊断完成！');
  process.exit(0);
}).catch(error => {
  console.error('❌ 诊断过程出错:', error);
  process.exit(1);
});


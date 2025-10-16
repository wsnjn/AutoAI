module.exports = {
  apps: [{
    name: 'autoai-backend',
    script: 'index.js',
    cwd: '/www/wwwroot/autoai/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DB_HOST: 'localhost',
      DB_USER: 'wslop',
      DB_PASSWORD: '345345',
      DB_NAME: 'autoai',
      DB_PORT: 3306
    },
    error_file: '/www/wwwroot/autoai/logs/err.log',
    out_file: '/www/wwwroot/autoai/logs/out.log',
    log_file: '/www/wwwroot/autoai/logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};

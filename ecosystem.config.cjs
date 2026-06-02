// PM2 进程配置：在项目根目录执行 `pm2 start ecosystem.config.cjs`
module.exports = {
  apps: [
    {
      name: 'word-cloud',
      script: 'server/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

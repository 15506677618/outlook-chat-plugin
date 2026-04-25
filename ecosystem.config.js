module.exports = {
  apps: [{
    name: 'outlook-chat-backend',
    script: 'src/backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/pm2/outlook-chat-error.log',
    out_file: '/var/log/pm2/outlook-chat-out.log',
    log_file: '/var/log/pm2/outlook-chat-combined.log',
    time: true,
    merge_logs: true
  }]
};

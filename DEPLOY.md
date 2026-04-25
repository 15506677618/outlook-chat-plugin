# 部署指南

## 快速部署到服务器

### 1. 准备服务器

- 阿里云 Ubuntu 20.04+ 服务器
- 域名已解析到服务器 IP（可选）
- SSH 访问权限

### 2. 执行部署脚本

SSH 登录服务器后执行：

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 安装 PM2 和 Nginx
npm install -g pm2
apt install -y nginx

# 克隆项目
git clone https://github.com/15506677618/outlook-chat-plugin.git
cd outlook-chat-plugin

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
nano .env  # 填入 SILICONFLOW_API_KEY

# 构建前端
npm run build

# 启动服务
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -1 | bash

# 配置 Nginx
cat > /etc/nginx/sites-available/koudai.xin << 'EOF'
server {
    listen 80;
    server_name koudai.xin www.koudai.xin;

    root /var/www/outlook-chat-plugin/dist;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

ln -s /etc/nginx/sites-available/koudai.xin /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
```

### 3. 安装 SSL 证书（推荐）

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d koudai.xin -d www.koudai.xin
```

### 4. 验证部署

```bash
# 检查服务状态
pm2 list
systemctl status nginx

# 测试 API
curl http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "测试"}], "userMessage": "测试"}'
```

## 常用命令

### PM2 管理

```bash
pm2 list                    # 查看所有进程
pm2 logs outlook-chat-backend  # 查看日志
pm2 restart outlook-chat-backend # 重启
pm2 stop outlook-chat-backend  # 停止
pm2 monit                   # 实时监控
```

### Nginx 管理

```bash
systemctl status nginx      # 查看状态
systemctl restart nginx     # 重启
systemctl reload nginx      # 重载配置
nginx -t                    # 测试配置
tail -f /var/log/nginx/error.log  # 查看错误日志
```

## 故障排查

### 后端服务无法启动

```bash
# 查看 PM2 日志
pm2 logs outlook-chat-backend

# 检查端口占用
netstat -tlnp | grep :3000

# 手动测试启动
cd /var/www/outlook-chat-plugin
node src/backend/server.js
```

### AI 服务不工作

```bash
# 检查 API Key 配置
cat .env | grep SILICONFLOW

# 重启服务
pm2 restart outlook-chat-backend

# 查看 AI 相关日志
pm2 logs outlook-chat-backend | grep -i "AI"
```

### Nginx 502 错误

```bash
# 检查后端是否运行
pm2 list

# 检查端口监听
netstat -tlnp | grep 3000

# 查看 Nginx 错误日志
tail -f /var/log/nginx/error.log

# 测试后端直接访问
curl http://localhost:3000/api/chat
```

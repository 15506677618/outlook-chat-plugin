# 阿里云 Ubuntu 部署指南（后端 + AI 服务）

本文档介绍如何将聊天插件（含 AI 服务）完整部署到阿里云 Ubuntu 服务器。

## 目录

- [架构说明](#架构说明)
- [前提条件](#前提条件)
- [服务器环境准备](#服务器环境准备)
- [项目部署](#项目部署)
- [配置 AI 服务](#配置 ai-服务)
- [使用 PM2 管理 Node.js 服务](#使用 pm2-管理 nodejs-服务)
- [Nginx 反向代理配置](#nginx-反向代理配置)
- [SSL 证书配置](#ssl-证书配置)
- [域名解析](#域名解析)
- [验证部署](#验证部署)
- [常用维护命令](#常用维护命令)
- [故障排查](#故障排查)

---

## 架构说明

当前项目包含：
- **前端**：静态页面（HTML/CSS/JS）
- **后端**：Node.js + Express 服务器
- **AI 服务**：SiliconFlow AI 接口代理

部署方式：
- Nginx 作为反向代理
- PM2 管理 Node.js 后端进程
- 静态文件由 Nginx 直接提供

---

## 前提条件

- 阿里云 ECS 实例（Ubuntu 20.04+）
- 域名已备案（如使用国内服务器）
- 域名：`koudai.xin`
- SSH 访问权限
- SiliconFlow API Key（用于 AI 服务）

---

## 服务器环境准备

### 1. 连接服务器

```bash
ssh root@你的服务器 IP
```

### 2. 更新系统

```bash
apt update && apt upgrade -y
```

### 3. 安装 Node.js（推荐 v18+）

```bash
# 使用 NodeSource 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 验证安装
node -v
npm -v
```

### 4. 安装 Nginx

```bash
apt install -y nginx
```

### 5. 安装 PM2（Node.js 进程管理器）

```bash
npm install -g pm2
```

### 6. 安装 Git

```bash
apt install -y git
```

---

## 项目部署

### 1. 创建项目目录

```bash
mkdir -p /var/www/outlook-chat-plugin
cd /var/www/outlook-chat-plugin
```

### 2. 克隆项目代码

```bash
git clone 你的仓库地址 .
```

### 3. 安装依赖

```bash
npm install
```

### 4. 构建前端（可选，如果使用 Vite 构建）

```bash
npm run build
```

构建后的文件会在 `dist/` 目录。

---

## 配置 AI 服务

### 1. 创建环境变量文件

```bash
cp .env.example .env
```

### 2. 编辑 `.env` 文件

```bash
nano .env
```

填入以下内容：

```env
# SiliconFlow AI API Key
SILICONFLOW_API_KEY=sk-your-actual-api-key-here

# 服务器端口
PORT=3000
```

**获取 API Key:** 访问 [SiliconFlow 云平台](https://cloud.siliconflow.cn/)

### 3. 设置文件权限（可选但推荐）

```bash
chmod 600 .env
```

---

## 使用 PM2 管理 Node.js 服务

### 1. 创建 PM2 配置文件（可选）

```bash
cat > ecosystem.config.js << 'EOF'
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
    time: true
  }]
};
EOF
```

### 2. 创建日志目录

```bash
mkdir -p /var/log/pm2
chown -R $USER:$USER /var/log/pm2
```

### 3. 启动服务

```bash
# 使用 PM2 启动
pm2 start ecosystem.config.js

# 或直接启动
pm2 start src/backend/server.js --name outlook-chat-backend
```

### 4. 设置开机自启

```bash
# 生成启动脚本
pm2 startup

# 根据提示执行命令，例如：
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root

# 保存当前进程列表
pm2 save
```

### 5. 查看服务状态

```bash
# 查看所有进程
pm2 list

# 查看日志
pm2 logs outlook-chat-backend

# 监控
pm2 monit
```

---

## Nginx 反向代理配置

### 1. 创建 Nginx 配置文件

```bash
cat > /etc/nginx/sites-available/koudai.xin << 'EOF'
server {
    listen 80;
    server_name koudai.xin www.koudai.xin;

    # 前端静态文件
    location / {
        root /var/www/outlook-chat-plugin/dist;
        index chat.html;
        
        # 静态文件缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
        
        # 根路径重定向到 chat.html
        location = / {
            return 301 /chat.html;
        }
        
        # 其他路径尝试返回对应文件，否则返回 chat.html
        try_files $uri $uri/ /chat.html;
    }
    
    # 反向代理到 Node.js 后端
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置（AI 响应可能较慢）
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # 访问日志
    access_log /var/log/nginx/koudai.xin-access.log;
    error_log /var/log/nginx/koudai.xin-error.log;
}
EOF
```

### 2. 启用站点

```bash
# 删除默认站点（可选）
rm -f /etc/nginx/sites-enabled/default

# 创建软链接
ln -s /etc/nginx/sites-available/koudai.xin /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重载 Nginx
systemctl reload nginx
```

### 3. 启动 Nginx

```bash
systemctl enable nginx
systemctl start nginx
```

---

## SSL 证书配置

### 使用 Let's Encrypt 免费证书

```bash
# 安装 Certbot
apt install -y certbot python3-certbot-nginx

# 获取证书（自动配置 Nginx）
certbot --nginx -d koudai.xin -d www.koudai.xin

# 自动续期测试
certbot renew --dry-run
```

Certbot 会自动修改 Nginx 配置添加 SSL 相关设置。

### 手动配置 HTTPS（可选）

如果使用阿里云 SSL 证书：

```bash
# 上传证书到服务器
mkdir -p /etc/nginx/ssl
# 上传 cert.pem 和 key.pem 到 /etc/nginx/ssl/

# 修改 Nginx 配置添加 HTTPS
cat > /etc/nginx/sites-available/koudai.xin-https << 'EOF'
server {
    listen 443 ssl http2;
    server_name koudai.xin www.koudai.xin;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... 其他配置同上 ...
}

# 强制 HTTP 跳转 HTTPS
server {
    listen 80;
    server_name koudai.xin www.koudai.xin;
    return 301 https://$server_name$request_uri;
}
EOF
```

---

## 域名解析

在阿里云 DNS 控制台添加记录：

| 记录类型 | 主机记录 | 解析线路 | 记录值 |
|---------|---------|---------|--------|
| A | @ | 默认 | 你的服务器 IP |
| A | www | 默认 | 你的服务器 IP |

等待 DNS 生效（通常 5-10 分钟）。

---

## 验证部署

### 1. 检查服务状态

```bash
# 检查 Nginx
systemctl status nginx

# 检查 Node.js 进程
pm2 list

# 检查端口监听
netstat -tlnp | grep -E ':(80|443|3000)'
```

### 2. 测试后端 API

```bash
# 测试 AI 接口
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "你好"}],
    "userMessage": "你好"
  }'

# 通过域名测试（配置 Nginx 后）
curl -X POST https://koudai.xin/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "你好"}],
    "userMessage": "你好"
  }'
```

### 3. 本地测试前端

```bash
curl -I https://koudai.xin/chat.html
```

### 4. 浏览器访问

- 聊天页面：https://koudai.xin/chat.html
- API 端点：https://koudai.xin/api/chat

---

## 常用维护命令

### PM2 相关

```bash
# 查看所有进程
pm2 list

# 重启应用
pm2 restart outlook-chat-backend

# 停止应用
pm2 stop outlook-chat-backend

# 查看日志
pm2 logs outlook-chat-backend --lines 100

# 实时监控
pm2 monit

# 查看进程详情
pm2 show outlook-chat-backend
```

### Nginx 相关

```bash
# 查看错误日志
tail -f /var/log/nginx/koudai.xin-error.log

# 查看访问日志
tail -f /var/log/nginx/koudai.xin-access.log

# 测试配置
nginx -t

# 重载配置
systemctl reload nginx

# 重启 Nginx
systemctl restart nginx
```

### 系统相关

```bash
# 查看系统资源
htop

# 查看磁盘空间
df -h

# 查看内存使用
free -h

# 查看 Node.js 进程
ps aux | grep node
```

---

## 故障排查

### 1. 后端服务无法启动

```bash
# 查看 PM2 日志
pm2 logs outlook-chat-backend

# 检查 .env 文件
cat /var/www/outlook-chat-plugin/.env

# 检查端口占用
netstat -tlnp | grep :3000

# 手动测试启动
cd /var/www/outlook-chat-plugin
node src/backend/server.js
```

### 2. AI 服务不工作

```bash
# 检查 .env 中的 API Key
nano /var/www/outlook-chat-plugin/.env

# 重启服务
pm2 restart outlook-chat-backend

# 查看日志
pm2 logs outlook-chat-backend | grep -i "AI"
```

### 3. Nginx 反向代理失败

```bash
# 检查 Nginx 配置
nginx -t

# 查看 Nginx 错误日志
tail -f /var/log/nginx/koudai.xin-error.log

# 测试后端是否可访问
curl http://localhost:3000/api/chat

# 重载 Nginx
systemctl reload nginx
```

### 4. 页面 404 Not Found

```bash
# 检查静态文件是否存在
ls -la /var/www/outlook-chat-plugin/dist/

# 检查 Nginx 配置中的 root 路径
cat /etc/nginx/sites-available/koudai.xin

# 检查权限
chown -R www-data:www-data /var/www/outlook-chat-plugin/
chmod -R 755 /var/www/outlook-chat-plugin/
```

### 5. SSL 证书问题

```bash
# 检查证书有效期
certbot certificates

# 续期证书
certbot renew

# 重载 Nginx
systemctl reload nginx
```

### 6. 内存不足

```bash
# 查看内存使用
free -h

# 限制 PM2 进程内存
pm2 restart outlook-chat-backend --max-memory-restart 500M

# 或编辑 ecosystem.config.js 设置 max_memory_restart
```

### 7. 端口冲突

```bash
# 查看端口占用
netstat -tlnp | grep :3000

# 杀死占用端口的进程
kill -9 <PID>

# 或修改 .env 中的 PORT
```

---

## 安全建议

### 1. 防火墙配置

```bash
# 安装 UFW
apt install -y ufw

# 允许 SSH
ufw allow ssh

# 允许 HTTP/HTTPS
ufw allow http
ufw allow https

# 启用防火墙
ufw enable

# 查看状态
ufw status
```

### 2. 限制 API 访问频率（可选）

在 Nginx 配置中添加：

```nginx
# 限制每个 IP 每秒请求数
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    # ... 其他配置 ...
}
```

### 3. 定期更新

```bash
# 更新系统包
apt update && apt upgrade -y

# 更新 Node.js 依赖
cd /var/www/outlook-chat-plugin
npm update

# 重启服务
pm2 restart outlook-chat-backend
```

---

## 性能优化建议

### 1. 启用 Gzip 压缩

在 Nginx 配置中添加：

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript 
           application/x-javascript application/xml+rss 
           application/json application/javascript;
```

### 2. 静态文件 CDN

考虑将静态文件（JS/CSS/图片）托管到 CDN，减轻服务器压力。

### 3. 数据库（未来扩展）

如果需要保存对话历史，建议安装 MongoDB 或 PostgreSQL。

---

## 完整部署检查清单

- [ ] Node.js 已安装
- [ ] PM2 已安装
- [ ] Nginx 已安装
- [ ] 项目代码已克隆
- [ ] 依赖已安装 (`npm install`)
- [ ] `.env` 文件已配置（含 AI API Key）
- [ ] PM2 服务已启动
- [ ] PM2 开机自启已配置
- [ ] Nginx 配置已完成
- [ ] Nginx 已启动
- [ ] SSL 证书已配置
- [ ] 域名解析已生效
- [ ] 防火墙已配置
- [ ] API 接口测试通过
- [ ] 前端页面访问通过

---

**部署完成！享受智能对话功能！** 🎉

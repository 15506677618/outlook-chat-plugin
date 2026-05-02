#!/bin/bash

# AI 邮件助手 - 阿里云一键部署脚本
# 使用方法: curl -fsSL https://raw.githubusercontent.com/15506677618/outlook-chat-plugin/master/deploy-aliyun.sh | bash

set -e

echo "🚀 开始部署 AI 邮件助手..."

# 配置变量
DOMAIN="koudai.xin"
API_KEY="${SILICONFLOW_API_KEY:-}"
ACCESS_PASS="${ACCESS_PASSWORD:-koudai123}"

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用 root 权限运行"
    exit 1
fi

# 1. 更新系统
echo "📦 更新系统..."
apt update && apt upgrade -y

# 2. 安装 Node.js 18
echo "📦 安装 Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi
node -v

# 3. 安装 PM2 和 Nginx
echo "📦 安装 PM2 和 Nginx..."
npm install -g pm2
apt install -y nginx git

# 4. 克隆项目
echo "📦 克隆项目..."
PROJECT_DIR="/var/www/outlook-chat-plugin"
if [ -d "$PROJECT_DIR" ]; then
    echo "项目已存在，执行更新..."
    cd $PROJECT_DIR
    git pull origin master
else
    git clone https://github.com/15506677618/outlook-chat-plugin.git $PROJECT_DIR
    cd $PROJECT_DIR
fi

# 5. 安装依赖
echo "📦 安装依赖..."
npm install

# 6. 配置环境变量
echo "⚙️  配置环境变量..."
if [ ! -f ".env" ]; then
    cat > .env << EOF
# SiliconFlow AI API 配置
SILICONFLOW_API_KEY=${API_KEY}

# 服务器端口
PORT=3000

# 访问密码
ACCESS_PASSWORD=${ACCESS_PASS}

# MCP 服务器地址
MCP_SERVER_URL=http://localhost:3001
EOF
    echo "✅ 已创建 .env 文件，请编辑填入正确的 API Key"
else
    echo "✅ .env 文件已存在"
fi

# 7. 启动主服务
echo "🚀 启动主服务..."
pm2 delete outlook-chat-backend 2>/dev/null || true
pm2 start ecosystem.config.js

# 8. 启动 MCP 服务器
echo "🚀 启动 MCP 服务器..."
cd mcp-server
npm install
pm2 delete mcp-server 2>/dev/null || true
pm2 start http-server.js --name mcp-server
cd ..

# 9. 保存 PM2 配置
pm2 save
pm2 startup | tail -1 | bash

# 10. 配置 Nginx
echo "⚙️  配置 Nginx..."
cat > /etc/nginx/sites-available/koudai.xin << 'EOF'
server {
    listen 80;
    server_name koudai.xin www.koudai.xin;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
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

ln -sf /etc/nginx/sites-available/koudai.xin /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# 11. 安装 SSL 证书（可选）
echo "🔒 安装 SSL 证书..."
read -p "是否安装 SSL 证书? (y/n): " install_ssl
if [ "$install_ssl" = "y" ]; then
    apt install -y certbot python3-certbot-nginx
    certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN
fi

# 12. 验证部署
echo "✅ 验证部署..."
echo ""
echo "服务状态:"
pm2 list

echo ""
echo "测试 API:"
sleep 2
curl -s http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ACCESS_PASS}" \
  -d '{"messages": [{"role": "user", "content": "测试"}], "userMessage": "测试"}' | head -c 200

echo ""
echo ""
echo "🎉 部署完成!"
echo ""
echo "访问地址:"
echo "  - HTTP:  http://${DOMAIN}"
echo "  - HTTPS: https://${DOMAIN} (如果安装了SSL)"
echo ""
echo "常用命令:"
echo "  pm2 list                    # 查看服务状态"
echo "  pm2 logs outlook-chat-backend  # 查看主服务日志"
echo "  pm2 logs mcp-server         # 查看MCP服务日志"
echo "  pm2 restart all             # 重启所有服务"
echo ""
echo "配置文件:"
echo "  ${PROJECT_DIR}/.env"
echo ""

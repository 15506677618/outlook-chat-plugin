#!/bin/bash

# 阿里云快速部署脚本
# 服务器：47.116.122.157
# 域名：koudai.xin

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="/var/www/outlook-chat-plugin"
DOMAIN="koudai.xin"
GIT_REPO="https://github.com/15506677618/outlook-chat-plugin.git"

echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║ Outlook Chat Plugin 部署脚本              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""

# 1. 更新系统
echo -e "${YELLOW}[1/8] 更新系统...${NC}"
apt update -qq && apt upgrade -y -qq

# 2. 安装 Node.js 18
echo -e "${YELLOW}[2/8] 安装 Node.js...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash - > /dev/null 2>&1
apt install -y nodejs > /dev/null 2>&1
echo -e "${GREEN}✓ Node.js $(node -v) 已安装${NC}"

# 3. 安装 PM2 和依赖
echo -e "${YELLOW}[3/8] 安装 PM2 和系统依赖...${NC}"
npm install -g pm2 > /dev/null 2>&1
apt install -y nginx git > /dev/null 2>&1
echo -e "${GREEN}✓ PM2 和 Nginx 已安装${NC}"

# 4. 创建项目目录并克隆代码
echo -e "${YELLOW}[4/8] 克隆项目代码...${NC}"
mkdir -p ${PROJECT_DIR}
cd ${PROJECT_DIR}
rm -rf * 2>/dev/null || true
git clone ${GIT_REPO} . > /dev/null 2>&1
echo -e "${GREEN}✓ 代码已克隆${NC}"

# 5. 安装依赖并构建
echo -e "${YELLOW}[5/8] 安装依赖并构建前端...${NC}"
cd ${PROJECT_DIR}
npm install --silent
npm run build > /dev/null 2>&1
echo -e "${GREEN}✓ 依赖已安装，前端已构建${NC}"

# 6. 配置环境变量（演示模式，无 API Key）
echo -e "${YELLOW}[6/8] 配置环境变量...${NC}"
cp .env.example .env
echo "SILICONFLOW_API_KEY=demo" > .env
echo "PORT=3000" >> .env
chmod 600 .env
echo -e "${YELLOW}⚠️  AI 服务为演示模式，需配置 API Key${NC}"
echo -e "${BLUE}配置方法：nano .env (填入真实的 SILICONFLOW_API_KEY)${NC}"

# 7. 配置 Nginx
echo -e "${YELLOW}[7/8] 配置 Nginx...${NC}"
cat > /etc/nginx/sites-available/${DOMAIN} << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN} 47.116.122.157;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    location / {
        root ${PROJECT_DIR}/dist;
        index chat.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
        
        location = / {
            return 301 /chat.html;
        }
        
        try_files \$uri \$uri/ /chat.html;
    }
    
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    access_log /var/log/nginx/${DOMAIN}-access.log;
    error_log /var/log/nginx/${DOMAIN}-error.log;
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -s /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/
nginx -t > /dev/null 2>&1
systemctl restart nginx
echo -e "${GREEN}✓ Nginx 已配置${NC}"

# 8. 启动应用
echo -e "${YELLOW}[8/8] 启动应用...${NC}"
mkdir -p /var/log/pm2
chown -R $USER:$USER /var/log/pm2

if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js
else
    pm2 start src/backend/server.js --name outlook-chat-backend
fi
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

echo -e "${GREEN}✓ 应用已启动${NC}"

# 验证
echo ""
echo -e "${YELLOW}验证服务...${NC}"
sleep 2

if pm2 list | grep -q "online"; then
    echo -e "${GREEN}✓ 后端进程已启动${NC}"
else
    echo -e "${RED}✗ 后端进程启动失败${NC}"
fi

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx 运行正常${NC}"
else
    echo -e "${RED}✗ Nginx 未运行${NC}"
fi

# 完成
echo ""
echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""
echo -e "${BLUE}访问地址：${NC}"
echo -e "  http://koudai.xin/chat.html"
echo -e "  http://www.koudai.xin/chat.html"
echo -e "  http://47.116.122.157/chat.html"
echo ""
echo -e "${YELLOW}重要提示：${NC}"
echo -e "  1. AI 服务当前为演示模式"
echo -e "  2. 配置 API Key: nano /var/www/outlook-chat-plugin/.env"
echo -e "  3. 配置后重启：pm2 restart outlook-chat-backend"
echo ""
echo -e "${BLUE}常用命令：${NC}"
echo -e "  pm2 logs outlook-chat-backend  # 查看日志"
echo -e "  pm2 restart outlook-chat-backend # 重启"
echo -e "  pm2 list                       # 查看状态"
echo ""

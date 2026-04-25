#!/bin/bash

# Outlook Chat Plugin 阿里云一键部署脚本
# 适用于 Ubuntu 20.04+，包含 AI 服务配置
# 服务器 IP: 47.116.122.157
# 域名：koudai.xin

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
PROJECT_DIR="/var/www/outlook-chat-plugin"
DOMAIN="koudai.xin"
NODE_VERSION="18"
PORT="3000"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Outlook Chat Plugin 阿里云一键部署脚本              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}服务器 IP: 47.116.122.157${NC}"
echo -e "${GREEN}部署域名：${DOMAIN}${NC}"
echo ""

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}错误：请使用 sudo 运行此脚本${NC}"
  echo -e "${YELLOW}使用方法：sudo ./deploy-alibaba-cloud.sh${NC}"
  exit 1
fi

echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}部署配置:${NC}"
echo -e "  项目目录：${PROJECT_DIR}"
echo -e "  域名：${DOMAIN}"
echo -e "  Node.js 版本：${NODE_VERSION}"
echo -e "  端口：${PORT}"
echo -e "${GREEN}==================================${NC}"
echo ""

# 1. 更新系统
echo -e "${YELLOW}[1/11] 更新系统...${NC}"
apt update -qq && apt upgrade -y -qq
echo -e "${GREEN}✓ 系统已更新${NC}"

# 2. 安装 Node.js
echo -e "${YELLOW}[2/11] 安装 Node.js ${NODE_VERSION}...${NC}"
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
apt install -y nodejs > /dev/null 2>&1

# 验证安装
NODE_VER=$(node -v)
NPM_VER=$(npm -v)
echo -e "${GREEN}✓ Node.js ${NODE_VER} 已安装${NC}"
echo -e "${GREEN}✓ npm ${NPM_VER} 已安装${NC}"

# 3. 安装系统依赖
echo -e "${YELLOW}[3/11] 安装系统依赖...${NC}"
apt install -y nginx git ufw curl > /dev/null 2>&1
echo -e "${GREEN}✓ 系统依赖已安装${NC}"

# 4. 安装 PM2
echo -e "${YELLOW}[4/11] 安装 PM2...${NC}"
npm install -g pm2 > /dev/null 2>&1
echo -e "${GREEN}✓ PM2 已安装${NC}"

# 5. 创建项目目录
echo -e "${YELLOW}[5/11] 创建项目目录...${NC}"
mkdir -p ${PROJECT_DIR}
cd ${PROJECT_DIR}
echo -e "${GREEN}✓ 项目目录已创建${NC}"

# 6. 克隆项目代码
echo -e "${YELLOW}[6/11] 克隆项目代码...${NC}"
echo -e "${YELLOW}请输入 Git 仓库地址（例如：https://github.com/yourname/outlook-chat-plugin.git）:${NC}"
read -p "Git Repository URL: " GIT_REPO

if [ -z "$GIT_REPO" ]; then
  echo -e "${RED}错误：Git 仓库地址不能为空${NC}"
  exit 1
fi

git clone ${GIT_REPO} . > /dev/null 2>&1
echo -e "${GREEN}✓ 代码已克隆${NC}"

# 7. 安装项目依赖
echo -e "${YELLOW}[7/11] 安装项目依赖...${NC}"
npm install --silent
echo -e "${GREEN}✓ 依赖已安装${NC}"

# 8. 构建前端
echo -e "${YELLOW}[8/11] 构建前端...${NC}"
npm run build > /dev/null 2>&1
echo -e "${GREEN}✓ 前端已构建${NC}"

# 9. 配置环境变量
echo -e "${YELLOW}[9/11] 配置环境变量...${NC}"
if [ -f ".env.example" ]; then
  cp .env.example .env
  echo -e "${GREEN}✓ .env 文件已创建${NC}"
  
  echo ""
  echo -e "${YELLOW}请输入 SiliconFlow API Key:${NC}"
  echo -e "${BLUE}获取 API Key: https://cloud.siliconflow.cn/${NC}"
  read -p "API Key: " API_KEY
  
  if [ -n "$API_KEY" ]; then
    sed -i "s/SILICONFLOW_API_KEY=YOUR_API_KEY_HERE/SILICONFLOW_API_KEY=${API_KEY}/" .env
    chmod 600 .env
    echo -e "${GREEN}✓ API Key 已配置${NC}"
  else
    echo -e "${YELLOW}警告：未配置 API Key，AI 服务将不可用${NC}"
  fi
else
  echo -e "${RED}警告：未找到 .env.example 文件${NC}"
fi

# 10. 配置 Nginx
echo -e "${YELLOW}[10/11] 配置 Nginx...${NC}"
cat > /etc/nginx/sites-available/${DOMAIN} << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/json application/javascript;

    # 前端静态文件
    root ${PROJECT_DIR}/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ =404;
    }
    
    # 反向代理到 Node.js 后端
    location /api/ {
        proxy_pass http://localhost:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    access_log /var/log/nginx/${DOMAIN}-access.log;
    error_log /var/log/nginx/${DOMAIN}-error.log;
}
EOF

# 启用站点
rm -f /etc/nginx/sites-enabled/default
ln -s /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/

# 测试 Nginx 配置
nginx -t > /dev/null 2>&1
systemctl restart nginx
echo -e "${GREEN}✓ Nginx 已配置${NC}"

# 创建 PM2 日志目录
mkdir -p /var/log/pm2
chown -R $USER:$USER /var/log/pm2

# 11. 启动应用
echo -e "${YELLOW}[11/11] 启动应用...${NC}"
if [ -f "ecosystem.config.js" ]; then
  pm2 start ecosystem.config.js
else
  pm2 start src/backend/server.js --name outlook-chat-backend
fi
pm2 save
pm2 startup | tail -1 | bash  # 设置开机自启
echo -e "${GREEN}✓ 应用已启动${NC}"

# 验证服务
echo ""
echo -e "${YELLOW}验证服务...${NC}"
sleep 3

# 检查后端
if curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT}/api/health 2>/dev/null | grep -q "200\|400"; then
  echo -e "${GREEN}✓ 后端服务正常${NC}"
else
  # 尝试检查是否运行
  if pm2 list | grep -q "online"; then
    echo -e "${GREEN}✓ 后端进程已启动${NC}"
  else
    echo -e "${YELLOW}⚠️  后端服务可能未正常启动，请检查日志${NC}"
  fi
fi

# 检查前端
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
  echo -e "${GREEN}✓ 前端构建成功${NC}"
else
  echo -e "${RED}✗ 前端构建失败${NC}"
fi

# 检查 Nginx
if systemctl is-active --quiet nginx; then
  echo -e "${GREEN}✓ Nginx 运行正常${NC}"
else
  echo -e "${RED}✗ Nginx 未运行${NC}"
fi

# 配置防火墙
echo ""
echo -e "${YELLOW}配置防火墙...${NC}"
ufw allow ssh > /dev/null 2>&1 || true
ufw allow http > /dev/null 2>&1 || true
ufw allow https > /dev/null 2>&1 || true
ufw --force enable > /dev/null 2>&1 || true
echo -e "${GREEN}✓ 防火墙已配置${NC}"

# 完成
echo ""
echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""
echo -e "${BLUE}访问地址：${NC}"
echo -e "  前端：http://${DOMAIN}/"
echo -e "  API:   http://${DOMAIN}/api/chat"
echo -e "  直接 IP: http://47.116.122.157/"
echo ""
echo -e "${BLUE}常用命令：${NC}"
echo -e "  查看日志：pm2 logs outlook-chat-backend"
echo -e "  重启应用：pm2 restart outlook-chat-backend"
echo -e "  查看状态：pm2 list"
echo -e "  实时监控：pm2 monit"
echo ""
echo -e "${BLUE}下一步操作：${NC}"
echo -e "  1. 在阿里云 DNS 控制台配置域名解析"
echo -e "     - 添加 A 记录：@ -> 47.116.122.157"
echo -e "     - 添加 A 记录：www -> 47.116.122.157"
echo ""
echo -e "  2. 安装 SSL 证书（推荐）"
echo -e "     sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
echo ""
echo -e "  3. 测试 AI 服务"
echo -e "     curl -X POST http://localhost:${PORT}/api/chat \\"
echo -e "       -H \"Content-Type: application/json\" \\"
echo -e "       -d '{\"messages\": [{\"role\": \"user\", \"content\": \"你好\"}]}'"
echo ""
echo -e "${GREEN}部署日志位置：${NC}"
echo -e "  Nginx: /var/log/nginx/${DOMAIN}-*.log"
echo -e "  PM2:   /var/log/pm2/*.log"
echo ""

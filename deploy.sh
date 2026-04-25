#!/bin/bash

# Outlook Chat Plugin 一键部署脚本
# 适用于 Ubuntu 20.04+

set -e

echo "🚀 开始部署 Outlook Chat Plugin..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}请使用 sudo 运行此脚本${NC}"
  exit 1
fi

# 配置变量
PROJECT_DIR="/var/www/outlook-chat-plugin"
DOMAIN="koudai.xin"
NODE_VERSION="18"
PORT="3000"

echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}部署配置:${NC}"
echo -e "  项目目录：${PROJECT_DIR}"
echo -e "  域名：${DOMAIN}"
echo -e "  Node.js 版本：${NODE_VERSION}"
echo -e "  端口：${PORT}"
echo -e "${GREEN}==================================${NC}"

# 1. 更新系统
echo -e "${YELLOW}[1/10] 更新系统...${NC}"
apt update && apt upgrade -y

# 2. 安装 Node.js
echo -e "${YELLOW}[2/10] 安装 Node.js ${NODE_VERSION}...${NC}"
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt install -y nodejs

# 验证安装
NODE_VER=$(node -v)
NPM_VER=$(npm -v)
echo -e "${GREEN}✓ Node.js ${NODE_VER} 已安装${NC}"
echo -e "${GREEN}✓ npm ${NPM_VER} 已安装${NC}"

# 3. 安装其他依赖
echo -e "${YELLOW}[3/10] 安装系统依赖...${NC}"
apt install -y nginx git ufw

# 4. 安装 PM2
echo -e "${YELLOW}[4/10] 安装 PM2...${NC}"
npm install -g pm2
echo -e "${GREEN}✓ PM2 已安装${NC}"

# 5. 创建项目目录
echo -e "${YELLOW}[5/10] 创建项目目录...${NC}"
mkdir -p ${PROJECT_DIR}
cd ${PROJECT_DIR}

# 6. 克隆项目代码
echo -e "${YELLOW}[6/10] 克隆项目代码...${NC}"
echo -e "${YELLOW}请输入 Git 仓库地址：${NC}"
read -p "Git Repository URL: " GIT_REPO

if [ -z "$GIT_REPO" ]; then
  echo -e "${RED}错误：Git 仓库地址不能为空${NC}"
  exit 1
fi

git clone ${GIT_REPO} .
echo -e "${GREEN}✓ 代码已克隆${NC}"

# 7. 安装项目依赖
echo -e "${YELLOW}[7/10] 安装项目依赖...${NC}"
npm install
echo -e "${GREEN}✓ 依赖已安装${NC}"

# 8. 构建前端
echo -e "${YELLOW}[8/10] 构建前端...${NC}"
npm run build
echo -e "${GREEN}✓ 前端已构建${NC}"

# 9. 配置环境变量
echo -e "${YELLOW}[9/10] 配置环境变量...${NC}"
if [ -f ".env.example" ]; then
  cp .env.example .env
  echo -e "${GREEN}✓ .env 文件已创建${NC}"
  
  echo -e "${YELLOW}请输入 SiliconFlow API Key:${NC}"
  read -p "API Key: " API_KEY
  
  if [ -n "$API_KEY" ]; then
    sed -i "s/SILICONFLOW_API_KEY=YOUR_API_KEY_HERE/SILICONFLOW_API_KEY=${API_KEY}/" .env
    echo -e "${GREEN}✓ API Key 已配置${NC}"
  else
    echo -e "${YELLOW}警告：未配置 API Key，AI 服务将使用演示模式${NC}"
  fi
else
  echo -e "${RED}警告：未找到 .env.example 文件${NC}"
fi

# 10. 配置 Nginx
echo -e "${YELLOW}[10/10] 配置 Nginx...${NC}"
cat > /etc/nginx/sites-available/${DOMAIN} << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # 前端静态文件
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
nginx -t
systemctl restart nginx
echo -e "${GREEN}✓ Nginx 已配置${NC}"

# 创建 PM2 日志目录
mkdir -p /var/log/pm2
chown -R $USER:$USER /var/log/pm2

# 启动应用
echo -e "${YELLOW}启动应用...${NC}"
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -1 | bash  # 设置开机自启
echo -e "${GREEN}✓ 应用已启动${NC}"

# 验证服务
echo -e "${YELLOW}验证服务...${NC}"
sleep 2
if curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT}/api/chat | grep -q "200\|400"; then
  echo -e "${GREEN}✓ 后端服务正常${NC}"
else
  echo -e "${YELLOW}⚠️  后端服务可能未正常启动，请检查日志${NC}"
fi

if [ -d "dist" ] && [ -f "dist/chat.html" ]; then
  echo -e "${GREEN}✓ 前端构建成功${NC}"
else
  echo -e "${RED}✗ 前端构建失败${NC}"
fi

# 配置防火墙
echo -e "${YELLOW}配置防火墙...${NC}"
ufw allow ssh || true
ufw allow http || true
ufw allow https || true
ufw --force enable || true
echo -e "${GREEN}✓ 防火墙已配置${NC}"

# 完成
echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""
echo -e "访问地址："
echo -e "  前端：http://${DOMAIN}/chat.html"
echo -e "  API:   http://${DOMAIN}/api/chat"
echo ""
echo -e "常用命令："
echo -e "  查看日志：pm2 logs outlook-chat-backend"
echo -e "  重启应用：pm2 restart outlook-chat-backend"
echo -e "  查看状态：pm2 list"
echo ""
echo -e "下一步："
echo -e "  1. 配置域名 DNS 解析"
echo -e "  2. 安装 SSL 证书：certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
echo -e "  3. 测试 AI 服务"
echo ""

#!/bin/bash

# AI 邮件助手 - 阿里云一键部署脚本

set -e

echo "🚀 开始部署 AI 邮件助手..."

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用 root 权限运行"
    exit 1
fi

# 1. 更新系统
#echo "📦 更新系统..."
#apt update && apt upgrade -y

# 2. 克隆项目
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

# 3. 安装依赖
echo "📦 安装依赖..."
npm install

# 4. 启动主服务
echo "🚀 启动主服务..."
pm2 delete outlook-chat-backend 2>/dev/null || true
pm2 start ecosystem.config.cjs

# 5. 启动 MCP 服务器
echo "🚀 启动 MCP 服务器..."
cd mcp-server
npm install
pm2 delete mcp-server 2>/dev/null || true
pm2 start http-server.js --name mcp-server
cd ..

# 6. 保存 PM2 配置
pm2 save
pm2 startup | tail -1 | bash

# 7. 验证部署
echo "✅ 验证部署..."
echo ""
echo "服务状态:"
pm2 list

echo ""
echo "🎉 部署完成!"
echo ""
echo "常用命令:"
echo "  pm2 list                    # 查看服务状态"
echo "  pm2 logs outlook-chat-backend  # 查看主服务日志"
echo "  pm2 logs mcp-server         # 查看MCP服务日志"
echo "  pm2 restart all             # 重启所有服务"
echo ""

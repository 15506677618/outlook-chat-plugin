#!/bin/bash

# OCR 优化更新脚本

echo "=== 开始更新 OCR 功能 ==="

# 1. 进入项目目录
cd /var/www/outlook-chat-plugin

# 2. 检查并安装 ImageMagick（用于图像预处理）
echo "检查 ImageMagick..."
if ! command -v convert &> /dev/null; then
    echo "ImageMagick 未安装，正在安装..."
    apt-get update
    apt-get install -y imagemagick
    echo "ImageMagick 安装完成"
else
    echo "ImageMagick 已安装"
fi

# 3. 拉取最新代码
echo "拉取最新代码..."
git pull origin main

# 4. 重启服务
echo "重启服务..."
pm2 restart 8

# 5. 查看日志
echo "查看服务日志..."
sleep 2
pm2 logs 8 --lines 20

echo "=== 更新完成 ==="

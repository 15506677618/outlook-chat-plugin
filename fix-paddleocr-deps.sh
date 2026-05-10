#!/bin/bash

# 修复 PaddleOCR 依赖问题

echo "=== 修复 PaddleOCR 依赖 ==="

# 安装 libGL 和其他必要的系统库
echo "安装系统依赖..."
apt-get update
apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libglib2.0-0

echo "=== 依赖安装完成 ==="
echo "现在可以重新运行 PaddleOCR 了"

# 测试 PaddleOCR
echo ""
echo "测试 PaddleOCR..."
paddleocr --version

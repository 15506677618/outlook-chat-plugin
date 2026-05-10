#!/bin/bash

# 安装 Tesseract 最佳中文识别模型脚本

echo "=== 安装 Tesseract 最佳中文识别模型 ==="

# 设置语言包目录
TESSDATA_DIR="/usr/share/tesseract-ocr/4.00/tessdata"

# 如果目录不存在，尝试其他常见路径
if [ ! -d "$TESSDATA_DIR" ]; then
    TESSDATA_DIR="/usr/share/tessdata"
fi

if [ ! -d "$TESSDATA_DIR" ]; then
    TESSDATA_DIR="/usr/local/share/tessdata"
fi

# 创建目录（如果不存在）
mkdir -p "$TESSDATA_DIR"

echo "语言包目录: $TESSDATA_DIR"
cd "$TESSDATA_DIR"

# 备份旧的 chi_sim.traineddata
if [ -f "chi_sim.traineddata" ]; then
    echo "备份旧的 chi_sim.traineddata..."
    mv chi_sim.traineddata chi_sim.traineddata.backup
fi

# 下载最佳中文模型
echo "下载 chi_sim_best.traineddata (约 40MB)..."
wget -O chi_sim.traineddata https://github.com/tesseract-ocr/tessdata_best/raw/main/chi_sim.traineddata

# 下载最佳英文模型
echo "下载 eng_best.traineddata..."
if [ -f "eng.traineddata" ]; then
    mv eng.traineddata eng.traineddata.backup
fi
wget -O eng.traineddata https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata

# 验证下载
if [ -f "chi_sim.traineddata" ]; then
    echo "✓ chi_sim.traineddata 下载成功"
    ls -lh chi_sim.traineddata
else
    echo "✗ chi_sim.traineddata 下载失败"
fi

if [ -f "eng.traineddata" ]; then
    echo "✓ eng.traineddata 下载成功"
    ls -lh eng.traineddata
else
    echo "✗ eng.traineddata 下载失败"
fi

# 测试识别
echo ""
echo "=== 测试识别效果 ==="
tesseract --list-langs | grep -E "chi_sim|eng"

echo ""
echo "=== 安装完成 ==="
echo "现在可以使用更好的中文识别模型了！"

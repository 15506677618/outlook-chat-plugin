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

# 方法1: 从 GitHub Release 下载（更稳定）
wget --progress=bar:force -O chi_sim.traineddata https://github.com/tesseract-ocr/tessdata/releases/download/4.1.0/chi_sim.traineddata 2>&1 || \
wget --progress=bar:force -O chi_sim.traineddata https://github.com/tesseract-ocr/tessdata_best/raw/main/chi_sim.traineddata 2>&1 || \
curl -L -o chi_sim.traineddata https://github.com/tesseract-ocr/tessdata/releases/download/4.1.0/chi_sim.traineddata

# 检查文件大小（best 模型应该大于 30MB）
FILE_SIZE=$(stat -c%s "chi_sim.traineddata" 2>/dev/null || stat -f%z "chi_sim.traineddata" 2>/dev/null)
echo "下载的文件大小: $FILE_SIZE 字节 ($(echo "scale=2; $FILE_SIZE/1024/1024" | bc) MB)"

if [ "$FILE_SIZE" -lt 30000000 ]; then
    echo "⚠️ 警告: 文件太小，尝试从其他镜像下载..."
    # 尝试从 Gitee 镜像下载（国内更快）
    wget --progress=bar:force -O chi_sim.traineddata https://gitee.com/mirrors/tesseract-ocr-tessdata/raw/main/chi_sim.traineddata 2>&1 || \
    curl -L -o chi_sim.traineddata https://gitee.com/mirrors/tesseract-ocr-tessdata/raw/main/chi_sim.traineddata
fi

# 下载最佳英文模型
echo "下载 eng_best.traineddata..."
if [ -f "eng.traineddata" ]; then
    mv eng.traineddata eng.traineddata.backup
fi

wget --progress=bar:force -O eng.traineddata https://github.com/tesseract-ocr/tessdata/releases/download/4.1.0/eng.traineddata 2>&1 || \
wget --progress=bar:force -O eng.traineddata https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata 2>&1 || \
curl -L -o eng.traineddata https://github.com/tesseract-ocr/tessdata/releases/download/4.1.0/eng.traineddata

# 检查英文模型大小
FILE_SIZE=$(stat -c%s "eng.traineddata" 2>/dev/null || stat -f%z "eng.traineddata" 2>/dev/null)
echo "下载的文件大小: $FILE_SIZE 字节 ($(echo "scale=2; $FILE_SIZE/1024/1024" | bc) MB)"

if [ "$FILE_SIZE" -lt 10000000 ]; then
    echo "⚠️ 警告: 文件太小，尝试从其他镜像下载..."
    wget --progress=bar:force -O eng.traineddata https://gitee.com/mirrors/tesseract-ocr-tessdata/raw/main/eng.traineddata 2>&1 || \
    curl -L -o eng.traineddata https://gitee.com/mirrors/tesseract-ocr-tessdata/raw/main/eng.traineddata
fi

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

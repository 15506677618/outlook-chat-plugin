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
# 使用 -L 跟随重定向，--max-redirect 防止循环
wget -L --max-redirect=5 -O chi_sim.traineddata https://github.com/tesseract-ocr/tessdata_best/raw/main/chi_sim.traineddata

# 检查文件大小（best 模型应该大于 30MB）
FILE_SIZE=$(stat -c%s "chi_sim.traineddata" 2>/dev/null || stat -f%z "chi_sim.traineddata" 2>/dev/null)
if [ "$FILE_SIZE" -lt 30000000 ]; then
    echo "⚠️ 警告: 文件大小只有 $FILE_SIZE 字节，可能下载不正确"
    echo "尝试使用 curl 下载..."
    curl -L -o chi_sim.traineddata https://github.com/tesseract-ocr/tessdata_best/raw/main/chi_sim.traineddata
fi

# 下载最佳英文模型
echo "下载 eng_best.traineddata..."
if [ -f "eng.traineddata" ]; then
    mv eng.traineddata eng.traineddata.backup
fi
wget -L --max-redirect=5 -O eng.traineddata https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata

# 检查英文模型大小
FILE_SIZE=$(stat -c%s "eng.traineddata" 2>/dev/null || stat -f%z "eng.traineddata" 2>/dev/null)
if [ "$FILE_SIZE" -lt 10000000 ]; then
    echo "⚠️ 警告: 英文模型文件大小只有 $FILE_SIZE 字节，可能下载不正确"
    echo "尝试使用 curl 下载..."
    curl -L -o eng.traineddata https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata
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

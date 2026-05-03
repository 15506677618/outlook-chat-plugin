#!/bin/bash
# 一键打包 Thunderbird 插件为 .xpi

set -e

PLUGIN_DIR="thunderbird-plugin"
XPI_NAME="ai-mail-assistant"

# 获取版本号
VERSION=$(python3 -c "import json; print(json.load(open('$PLUGIN_DIR/manifest.json'))['version'])")
XPI_FILE="${XPI_NAME}-v${VERSION}.xpi"

echo "🔧 开始打包 Thunderbird 插件..."
echo "📦 版本: $VERSION"

# 删除旧文件
rm -f "${XPI_NAME}"-*.xpi

# 使用 Python 打包
python3 << PYEOF
import zipfile
import os

xpi_name = "$XPI_FILE"
plugin_dir = "$PLUGIN_DIR"

with zipfile.ZipFile(xpi_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
    # 添加根目录文件
    root_files = ['manifest.json', 'background.js', 'chat-window.js', 
                  'chat-window.html', 'button-style.css', 'config.js', 'styles.css']
    
    for file in root_files:
        filepath = os.path.join(plugin_dir, file)
        if os.path.isfile(filepath):
            print(f'  Adding: {file}')
            zipf.write(filepath, file)
        else:
            print(f'  ⚠️  Warning: {file} not found')
    
    # 添加 icons 目录
    icons_dir = os.path.join(plugin_dir, 'icons')
    if os.path.isdir(icons_dir):
        for file in os.listdir(icons_dir):
            filepath = os.path.join(icons_dir, file)
            if os.path.isfile(filepath):
                arcname = os.path.join('icons', file)
                print(f'  Adding: {arcname}')
                zipf.write(filepath, arcname)
    else:
        print(f'  ⚠️  Warning: icons/ directory not found')

size = os.path.getsize(xpi_name)
print(f'\n✅ 打包完成: {xpi_name} ({size} bytes)')
PYEOF

echo ""
echo "📍 文件位置: $(pwd)/${XPI_FILE}"
echo ""
echo "🚀 安装方式："
echo "   Thunderbird → 工具 → Add-ons and Themes → 齿轮图标 → Install Add-on From File"
echo "   选择 ${XPI_FILE} 即可"

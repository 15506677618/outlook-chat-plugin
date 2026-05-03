@echo off
chcp 65001 >nul
echo.
echo 🔧 快速打包 Thunderbird 插件
echo.

echo 📦 正在打包...
bash pack-xpi.sh
if errorlevel 1 (
    echo ❌ 打包失败
    pause
    exit /b 1
)

echo.
echo ✅ 打包完成!
echo.

REM 复制到 thunderbird-plugin 目录
wsl cp /mnt/d/UVProjects/outlook-chat-plugin/ai-mail-assistant-v2.1.0.xpi /mnt/d/UVProjects/outlook-chat-plugin/thunderbird-plugin/

for %%F in ("thunderbird-plugin\ai-mail-assistant-v2.1.0.xpi") do set "fullPath=%%~dpnxF"
echo 📍 XPI 文件: %fullPath%
echo.

REM 询问是否打开 Thunderbird
set /p openThunderbird="是否打开 Thunderbird 安装插件? (y/n): "
if /i "%openThunderbird%"=="y" (
    set "thunderbirdExe=C:\Program Files\Mozilla Thunderbird\thunderbird.exe"
    if not exist "!thunderbirdExe!" (
        set "thunderbirdExe=C:\Program Files (x86)\Mozilla Thunderbird\thunderbird.exe"
    )
    
    if exist "!thunderbirdExe!" (
        echo 🚀 启动 Thunderbird...
        start "" "!thunderbirdExe!"
        echo.
        echo 💡 安装步骤:
        echo    1. 按 Ctrl+Shift+A 打开附加组件管理器
        echo    2. 点击齿轮图标 ⚙️ → Install Add-on From File
        echo    3. 选择: %fullPath%
    ) else (
        echo ❌ 找不到 Thunderbird
    )
)

echo.
pause

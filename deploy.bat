@echo off
echo =====================================
echo   Outlook Chat Plugin 部署助手
echo =====================================
echo.
echo 服务器：47.116.122.157
echo 用户：root
echo.
echo 正在打开 SSH 连接...
echo.
echo 请在 SSH 连接后:
echo 1. 输入服务器密码登录
echo 2. 复制 deploy-commands.txt 中的所有内容
echo 3. 粘贴到 SSH 终端中执行
echo.
echo 按任意键打开 SSH 连接...
pause >nul

ssh root@47.116.122.157

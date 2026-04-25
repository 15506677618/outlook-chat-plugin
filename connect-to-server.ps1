# 阿里云部署连接脚本
# 服务器：47.116.122.157

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  阿里云 Outlook Chat Plugin 部署" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "服务器 IP: 47.116.122.157" -ForegroundColor Green
Write-Host "用户名：root" -ForegroundColor Green
Write-Host ""
Write-Host "请按照以下步骤操作：" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. 复制下面的部署脚本内容" -ForegroundColor Cyan
Write-Host "2. SSH 登录到服务器" -ForegroundColor Cyan
Write-Host "3. 在服务器上创建并执行脚本" -ForegroundColor Cyan
Write-Host ""
Write-Host "按任意键继续..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# 显示部署脚本内容供复制
Write-Host "`n===== 部署脚本内容 (请复制) =====" -ForegroundColor Green
Get-Content -Path ".\quick-deploy.sh" -Raw
Write-Host "`n===== 脚本结束 =====" -ForegroundColor Green

Write-Host "`n`n在服务器上执行的命令：" -ForegroundColor Cyan
Write-Host "  ssh root@47.116.122.157" -ForegroundColor White
Write-Host "  然后创建文件：cat > /root/deploy.sh" -ForegroundColor White
Write-Host "  粘贴上面的脚本内容" -ForegroundColor White
Write-Host "  按 Ctrl+D 保存" -ForegroundColor White
Write-Host "  chmod +x /root/deploy.sh" -ForegroundColor White
Write-Host "  sudo ./deploy.sh" -ForegroundColor White

# 一键停止所有开发服务 (PowerShell 版本)

Write-Host "🛑 正在停止所有开发服务..." -ForegroundColor Yellow

# 停止 MCP HTTP 服务器 (端口 3001)
Write-Host "📦 停止 MCP 服务器 (端口 3001)..." -ForegroundColor Cyan
$mcpProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*http-server.js*" }
if ($mcpProcess) {
    Stop-Process -Id $mcpProcess.Id -Force
    Write-Host "   ✅ MCP 服务器已停止" -ForegroundColor Green
} else {
    Write-Host "   ⚠️ MCP 服务器未运行" -ForegroundColor Gray
}

# 停止主后端服务器 (端口 3002)
Write-Host "🖥️ 停止主后端服务器 (端口 3002)..." -ForegroundColor Cyan
$backendProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*server.js*" -and $_.CommandLine -notlike "*http-server.js*" }
if ($backendProcess) {
    Stop-Process -Id $backendProcess.Id -Force
    Write-Host "   ✅ 主后端服务器已停止" -ForegroundColor Green
} else {
    Write-Host "   ⚠️ 主后端服务器未运行" -ForegroundColor Gray
}

# 停止 Vite 开发服务器 (端口 5173)
Write-Host "🌐 停止 Vite 开发服务器 (端口 5173)..." -ForegroundColor Cyan
$viteProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*vite*" }
if ($viteProcess) {
    Stop-Process -Id $viteProcess.Id -Force
    Write-Host "   ✅ Vite 服务器已停止" -ForegroundColor Green
} else {
    Write-Host "   ⚠️ Vite 服务器未运行" -ForegroundColor Gray
}

# 额外检查并释放端口
Write-Host "🔍 检查并释放端口..." -ForegroundColor Cyan

# 检查端口 3001
$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($port3001) {
    $process = Get-Process -Id $port3001.OwningProcess -ErrorAction SilentlyContinue
    if ($process) {
        Stop-Process -Id $process.Id -Force
        Write-Host "   ✅ 释放端口 3001 (PID: $($process.Id))" -ForegroundColor Green
    }
}

# 检查端口 3002
$port3002 = Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue
if ($port3002) {
    $process = Get-Process -Id $port3002.OwningProcess -ErrorAction SilentlyContinue
    if ($process) {
        Stop-Process -Id $process.Id -Force
        Write-Host "   ✅ 释放端口 3002 (PID: $($process.Id))" -ForegroundColor Green
    }
}

# 检查端口 5173
$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
if ($port5173) {
    $process = Get-Process -Id $port5173.OwningProcess -ErrorAction SilentlyContinue
    if ($process) {
        Stop-Process -Id $process.Id -Force
        Write-Host "   ✅ 释放端口 5173 (PID: $($process.Id))" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✅ 所有服务已停止！" -ForegroundColor Green
Write-Host ""
Write-Host "已停止的服务：" -ForegroundColor White
Write-Host "   ❌ MCP 服务器 (端口 3001)" -ForegroundColor Red
Write-Host "   ❌ 主后端服务器 (端口 3002)" -ForegroundColor Red
Write-Host "   ❌ Vite 开发服务器 (端口 5173)" -ForegroundColor Red

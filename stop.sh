#!/bin/bash
# 一键停止所有开发服务

echo "🛑 正在停止所有开发服务..."

# 停止 MCP HTTP 服务器 (端口 3001)
echo "📦 停止 MCP 服务器 (端口 3001)..."
pkill -f "node http-server.js" 2>/dev/null || echo "   MCP 服务器未运行"

# 停止主后端服务器 (端口 3002)
echo "🖥️ 停止主后端服务器 (端口 3002)..."
pkill -f "node src/backend/server.js" 2>/dev/null || echo "   主后端服务器未运行"

# 停止 Vite 开发服务器 (端口 5173)
echo "🌐 停止 Vite 开发服务器 (端口 5173)..."
pkill -f "vite" 2>/dev/null || echo "   Vite 服务器未运行"

# 额外检查并释放端口
echo "🔍 检查并释放端口..."

# 检查端口 3001
PID_3001=$(lsof -t -i:3001 2>/dev/null)
if [ -n "$PID_3001" ]; then
    echo "   释放端口 3001 (PID: $PID_3001)"
    kill -9 $PID_3001 2>/dev/null
fi

# 检查端口 3002
PID_3002=$(lsof -t -i:3002 2>/dev/null)
if [ -n "$PID_3002" ]; then
    echo "   释放端口 3002 (PID: $PID_3002)"
    kill -9 $PID_3002 2>/dev/null
fi

# 检查端口 5173
PID_5173=$(lsof -t -i:5173 2>/dev/null)
if [ -n "$PID_5173" ]; then
    echo "   释放端口 5173 (PID: $PID_5173)"
    kill -9 $PID_5173 2>/dev/null
fi

echo ""
echo "✅ 所有服务已停止！"
echo ""
echo "已停止的服务："
echo "   ❌ MCP 服务器 (端口 3001)"
echo "   ❌ 主后端服务器 (端口 3002)"
echo "   ❌ Vite 开发服务器 (端口 5173)"

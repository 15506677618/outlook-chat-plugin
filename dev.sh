#!/bin/bash
# 一键启动开发环境

set -e

# 加载 local.env
export $(grep -v '^#' local.env | xargs)

echo "🚀 启动开发环境 (Local Mode)..."
echo "📋 配置文件: local.env"

# 启动 MCP HTTP 服务器 (端口 3001)
echo "📦 启动 MCP 服务器..."
cd mcp-server
node http-server.js &
MCP_PID=$!
cd ..

sleep 2

# 启动主后端服务器 (端口 3002)
echo "🖥️ 启动主后端服务器..."
node src/backend/server.js &
BACKEND_PID=$!

sleep 2

# 启动 Vite 开发服务器 (端口 5173)
echo "🌐 启动 Vite 开发服务器..."
npm run dev &
VITE_PID=$!

echo ""
echo "✅ 开发环境已启动！"
echo "   MCP 服务器: http://localhost:3001"
echo "   主后端: http://localhost:3002"
echo "   前端 (热更新): http://localhost:5173"
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $MCP_PID $BACKEND_PID $VITE_PID 2>/dev/null; exit" INT TERM
wait

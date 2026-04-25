# 测试 AI 服务

## 快速测试

启动服务器后（`npm run server`），可以使用以下命令测试 AI 接口：

### 使用 curl 测试

```bash
curl --request POST \
  --url http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "你好，请介绍一下你自己"}
    ],
    "userMessage": "你好，请介绍一下你自己"
  }'
```

### 使用 PowerShell 测试（Windows）

```powershell
$body = @{
    messages = @(
        @{role = "user"; content = "你好，请介绍一下你自己"}
    )
    userMessage = "你好，请介绍一下你自己"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/chat" -Method Post -Body $body -ContentType "application/json"
```

## 预期响应

如果 AI 服务配置正确，你应该收到类似这样的响应：

```json
{
  "response": "你好！我是 AI 助手...",
  "message": "你好！我是 AI 助手...",
  "timestamp": "2026-04-18T10:00:00.000Z",
  "model": "Pro/zai-org/GLM-4.7"
}
```

## 如果没有配置 API Key

如果 `.env` 文件中没有配置有效的 API Key，你会收到演示模式的回复：

```json
{
  "response": "这是演示模式下的回复。您发送的消息是：\"你好，请介绍一下你自己\"。\n\nAI 服务暂时不可用：...",
  "message": "...",
  "timestamp": "2026-04-18T10:00:00.000Z",
  "error": "..."
}
```

## 常见问题

### 1. 401 Unauthorized
- API Key 无效或未配置
- 检查 `.env` 文件中的 `SILICONFLOW_API_KEY`

### 2. 404 Not Found
- 模型名称错误
- 确认模型 `Pro/zai-org/GLM-4.7` 可用

### 3. 网络连接超时
- 检查网络连接
- 确认可以访问 `https://api.siliconflow.cn`

### 4. 500 Internal Server Error
- 查看服务器控制台日志
- 确认 `node-fetch` 已安装

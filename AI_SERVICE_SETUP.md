# AI 服务配置说明

## 获取 SiliconFlow API Key

1. 访问 [SiliconFlow 云平台](https://cloud.siliconflow.cn/)
2. 注册/登录账号
3. 在控制台获取 API Key

## 配置环境变量

### 方法 1：使用 .env 文件

1. 复制示例文件：
   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env` 文件，填入你的 API Key：
   ```env
   SILICONFLOW_API_KEY=sk-your-actual-api-key-here
   PORT=3000
   ```

### 方法 2：使用系统环境变量

**Windows (PowerShell):**
```powershell
$env:SILICONFLOW_API_KEY="sk-your-actual-api-key-here"
```

**Linux/Mac:**
```bash
export SILICONFLOW_API_KEY="sk-your-actual-api-key-here"
```

## 启动服务

### 启动后端服务器
```bash
npm run server
```

服务器会运行在 `http://localhost:3000`

### 启动前端开发服务器
```bash
npm run dev
```

## 测试 AI 聊天

1. 确保后端服务器已启动
2. 打开浏览器访问：`http://localhost:5173` (Vite 默认端口) 或 `http://localhost:3000/chat.html`
3. 在聊天窗口输入消息
4. AI 会自动回复

## API 接口说明

### 请求格式
```bash
curl --request POST \
  --url https://api.siliconflow.cn/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "Pro/zai-org/GLM-4.7",
    "messages": [
      {"role": "system", "content": "你是一个有用的助手"},
      {"role": "user", "content": "你好"}
    ]
  }'
```

### 响应格式
```json
{
  "choices": [
    {
      "message": {
        "content": "你好！我是 AI 助手..."
      }
    }
  ]
}
```

## 故障排除

### 1. API Key 无效
- 检查 `.env` 文件中的 API Key 是否正确
- 确认 API Key 格式正确（通常以 `sk-` 开头）

### 2. 网络连接问题
- 检查网络连接
- 确认可以访问 `https://api.siliconflow.cn`

### 3. 模型不可用
- 检查模型名称是否正确：`Pro/zai-org/GLM-4.7`
- 查看 SiliconFlow 平台确认模型可用性

### 4. 后端服务未响应
- 检查服务器是否启动：`npm run server`
- 查看控制台日志获取错误信息

## 安全提示

⚠️ **重要：**
- 不要将 `.env` 文件提交到版本控制系统
- `.env` 文件已在 `.gitignore` 中排除
- 不要在前端代码中硬编码 API Key
- 所有 API 调用都应该通过后端服务器进行

## 自定义配置

### 更改 AI 模型

编辑 `src/backend/server.js`：
```javascript
const SILICONFLOW_MODEL = 'Pro/zai-org/GLM-4.7'; // 更改为你想要的模型
```

### 更改系统提示

编辑 `src/backend/server.js` 中的 `/api/chat` 路由：
```javascript
messages: [
  { role: 'system', content: '自定义系统提示...' },
  ...messages
]
```

### 更改 API 端点

如果需要支持其他 AI 服务，可以修改：
```javascript
const SILICONFLOW_API_URL = 'https://your-api-endpoint.com/v1/chat/completions';
```

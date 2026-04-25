# Outlook Chat Plugin - AI 服务集成

## ✅ 已完成

本项目现已集成 SiliconFlow AI 服务，支持使用 GLM-4.7 模型进行智能对话。

## 📋 功能特性

- ✨ 集成 SiliconFlow AI 接口
- 🤖 使用 GLM-4.7 大语言模型
- 🔄 支持多轮对话（保留对话历史）
- 🛡️ 安全的后端代理（API Key 不暴露在前端）
- ⚠️ 降级处理（AI 服务不可用时自动切换到演示模式）
- 📝 详细的错误日志

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

复制环境变量示例文件：
```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 SiliconFlow API Key：
```env
SILICONFLOW_API_KEY=sk-your-actual-api-key-here
PORT=3000
```

**获取 API Key:** 访问 [SiliconFlow 云平台](https://cloud.siliconflow.cn/)

### 3. 启动后端服务器

```bash
npm run server
```

服务器会运行在 `http://localhost:3000`

### 4. 启动前端（可选）

```bash
npm run dev
```

访问 `http://localhost:5173`

### 5. 开始聊天

打开浏览器访问：`http://localhost:3000/chat.html`

## 📁 项目结构

```
outlook-chat-plugin/
├── src/
│   ├── app.js              # 前端聊天逻辑
│   ├── index.html          # 前端页面
│   ├── styles.css          # 样式文件
│   └── backend/
│       └── server.js       # 后端服务器（含 AI 接口调用）
├── .env.example            # 环境变量示例
├── .env                    # 环境变量配置（需自行创建）
├── package.json
└── AI_SERVICE_SETUP.md     # 详细配置说明
```

## 🔧 技术栈

### 前端
- Vanilla JavaScript
- HTML5
- CSS3

### 后端
- Node.js
- Express.js
- node-fetch
- CORS

### AI 服务
- SiliconFlow API
- GLM-4.7 模型

## 📖 API 接口

### 聊天接口

**请求:**
```http
POST /api/chat
Content-Type: application/json

{
  "messages": [
    {"role": "user", "content": "你好"}
  ],
  "userMessage": "你好"
}
```

**响应:**
```json
{
  "response": "你好！我是 AI 助手...",
  "message": "你好！我是 AI 助手...",
  "timestamp": "2026-04-18T10:00:00.000Z",
  "model": "Pro/zai-org/GLM-4.7"
}
```

## 🔒 安全说明

- ✅ API Key 存储在后端（`.env` 文件）
- ✅ `.env` 文件已在 `.gitignore` 中排除
- ✅ 所有 AI 请求通过后端代理
- ✅ 前端无法直接访问 API Key

## 📝 相关文档

- [AI_SERVICE_SETUP.md](./AI_SERVICE_SETUP.md) - 详细配置说明
- [TEST_AI.md](./TEST_AI.md) - 测试方法
- [README.md](./README.md) - 项目总览

## 🐛 故障排除

### 1. AI 服务不工作
- 检查 `.env` 文件是否存在
- 确认 API Key 正确
- 查看服务器控制台日志

### 2. 跨域问题
- 确保后端已启动 CORS
- 检查前端请求的 URL

### 3. 依赖问题
```bash
# 重新安装依赖
rm -rf node_modules package-lock.json
npm install
```

## 📞 获取帮助

如有问题，请查看：
1. 服务器控制台日志
2. 浏览器开发者工具
3. 相关文档

## 🎯 下一步

- [ ] 添加更多 AI 模型支持
- [ ] 实现流式响应
- [ ] 添加对话历史管理
- [ ] 支持文件上传
- [ ] 添加语音输入

---

**享受智能对话！** 🎉

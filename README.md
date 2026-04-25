# AI 邮件助手 - Thunderbird 插件

一个集成 AI 聊天功能的 Thunderbird 插件，可以智能分析邮件内容并与用户对话。

## 功能特点

- 📧 **自动读取邮件** - 自动获取当前打开的邮件内容
- 💬 **AI 智能对话** - 与 AI 助手讨论邮件内容
- 🤖 **智能分析** - AI 可以总结、分析、解答邮件相关问题
- 🎨 **双栏界面** - 左侧显示邮件，右侧进行 AI 对话
- ⚡ **实时响应** - 基于 SiliconFlow AI 的快速响应

## 项目结构

```
outlook-chat-plugin/
├── package.json              # 项目配置
├── vite.config.js            # Vite 构建配置
├── src/                      # 网页版前端代码
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── backend/
│       └── server.js         # Node.js 后端服务器
├── thunderbird-plugin/       # Thunderbird 插件
│   ├── manifest.json         # 插件配置
│   ├── background.js         # 后台脚本
│   ├── chat-window.html      # 聊天窗口界面
│   ├── chat-window.js        # 聊天窗口逻辑
│   └── icons/                # 图标文件
└── dist/                     # 构建产物
```

## 安装插件

### 方式一：直接安装（推荐）

1. 下载本项目并打包插件（见下方"打包插件"）
2. 打开 Thunderbird
3. 按 `Ctrl+Shift+A` 打开附加组件管理器
4. 点击齿轮图标 ⚙️ > **从文件安装附加组件**
5. 选择 `ai-mail-assistant.xpi` 文件
6. 重启 Thunderbird

### 方式二：开发模式安装

1. 打开 Thunderbird
2. 按 `Alt` 键显示菜单栏
3. 点击 **工具** > **开发者工具** > **调试插件**
4. 点击 **临时加载附加组件**
5. 选择 `thunderbird-plugin/manifest.json`

## 使用方法

1. **打开 Thunderbird**
2. **打开任意一封邮件**
3. **点击工具栏中的"AI 邮件助手"图标**
4. **在新打开的标签页中与 AI 对话**

### 示例对话

- "这封邮件的主要内容是什么？"
- "帮我总结一下邮件"
- "发件人希望我做什么？"
- "帮我草拟一个回复"
- "邮件中提到的重要日期有哪些？"

## 部署后端服务（可选）

如果需要真实的 AI 服务（而非演示模式），需要部署后端服务器：

### 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入 SiliconFlow API Key

# 启动服务
npm start
```

### 服务器部署

详见 [DEPLOY.md](./DEPLOY.md)

## 配置 AI 服务

1. 获取 API Key：访问 https://cloud.siliconflow.cn/
2. 编辑 `.env` 文件：
   ```
   SILICONFLOW_API_KEY=sk-your-api-key-here
   ```
3. 重启服务

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **后端**: Node.js, Express
- **AI 服务**: SiliconFlow AI (GLM-4.7)
- **构建工具**: Vite
- **插件平台**: Thunderbird MailExtensions

## 注意事项

- 插件需要 Thunderbird 115.0 或更高版本
- AI 服务需要有效的 SiliconFlow API Key
- 首次安装后需要重启 Thunderbird

## 许可证

MIT License

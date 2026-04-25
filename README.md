# Thunderbird 聊天插件

一个支持 Thunderbird 浏览器的 AI 聊天插件，集成 SiliconFlow AI 服务。

## 项目结构

```
outlook-chat-plugin/
├── package.json          # 项目配置
├── vite.config.js        # Vite 配置
├── dist/                 # 构建产物
├── src/
│   ├── index.html        # 前端页面
│   ├── styles.css        # 样式文件
│   ├── app.js            # 前端逻辑
│   └── backend/
│       └── server.js     # 后端服务器
└── thunderbird-plugin/   # Thunderbird 插件文件
    ├── manifest.json     # 插件清单
    ├── background.js     # 后台脚本
    ├── sidebar.html/js   # 侧边栏
    └── chat-window.html/js  # 聊天窗口
```

## 快速开始

### 方式一：使用 Thunderbird 插件

1. 构建项目：
```bash
cd outlook-chat-plugin
npm install
npm run build
```

2. 在 Thunderbird 中加载插件：
   - 打开 Thunderbird
   - 菜单 → 工具 → 附加组件
   - 点击齿轮图标 → "从文件安装附加组件"
   - 选择 `thunderbird-plugin/` 文件夹

### 方式二：使用本地开发服务器

```bash
cd outlook-chat-plugin
npm install
npm run server
```

访问 http://localhost:5173/chat.html

## 配置说明

### API 配置

前端请求发送到 `http://localhost:3000/api/chat`

生产环境修改为：`https://koudai.xin/api/chat`

### Thunderbird 插件配置

在 `thunderbird-plugin/manifest.json` 中配置：
- 插件名称和描述
- 权限设置
- 图标路径

## 功能

- ✅ 现代聊天界面
- ✅ 实时消息显示
- ✅ 打字指示器动画
- ✅ 自动滚动到底部
- ✅ 支持 Enter 发送消息
- ✅ 支持 Shift+Enter 换行
- ✅ 错误处理和用户反馈

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// 为 Node < 18 提供 fetch polyfill
if (!globalThis.fetch) {
  await import('node-fetch').then(module => {
    globalThis.fetch = module.default;
  });
}

// 加载环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002; // 改为3002，避免与server-mcp.js冲突

// SiliconFlow AI 配置
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || 'YOUR_API_KEY';
const SILICONFLOW_MODEL = 'Pro/zai-org/GLM-4.7';

// 访问控制配置
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || 'koudai123';

// 简单的密码保护中间件
function requirePassword(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: '需要访问密码',
      message: '请在请求头中提供 Authorization: Bearer <密码>'
    });
  }
  
  const token = authHeader.substring(7);
  
  if (token !== ACCESS_PASSWORD) {
    return res.status(403).json({ 
      error: '访问被拒绝',
      message: '密码错误'
    });
  }
  
  next();
}

// CORS 配置 - 允许所有来源但限制某些操作
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static(join(__dirname, '..', '..', 'dist')));

// 受保护的 API 接口
app.post('/api/chat', requirePassword, async (req, res) => {
  const { messages, userMessage } = req.body;

  try {
    // 调用 SiliconFlow AI 接口
    const response = await fetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`
      },
      body: JSON.stringify({
        model: SILICONFLOW_MODEL,
        messages: [
          { role: 'system', content: '你是一个专业的邮件分析助手。\n\n【重要规则】\n1. 分析邮件时，只提取邮件中**明确提到**的信息，不要猜测或编造\n2. 如果某个字段在邮件中没有提到，标注为"未提供"或留空\n3. 添加询价/报价记录时，必须严格按照邮件内容执行，不能产生幻觉\n4. 不确定的信息要告知用户，不要擅自填充\n\n你可以使用 HTML 标签美化回复：<b>/<strong> 加粗、<br> 换行、<p> 段落、<ul>/<li> 列表、<h3> 标题等。' },
          ...messages
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('AI API 错误:', response.status, errorData);
      throw new Error(`AI API 错误：${response.status}`);
    }

    const data = await response.json();
    const botReply = data.choices?.[0]?.message?.content || '抱歉，我没有理解。';

    res.json({
      response: botReply,
      message: botReply,
      timestamp: new Date().toISOString(),
      model: SILICONFLOW_MODEL
    });

  } catch (error) {
    console.error('Chat 错误:', error);
    
    // 如果 AI 服务不可用，返回演示模式回复
    const botReply = `这是演示模式下的回复。您发送的消息是: "${userMessage}"。\n\nAI 服务暂时不可用：${error.message}`;
    
    res.json({
      response: botReply,
      message: botReply,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// MCP 代理路由
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';

// MCP 工具列表
app.get('/api/mcp/tools', async (req, res) => {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/mcp/tools`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'MCP 服务不可用' });
  }
});

// MCP 工具调用
app.post('/api/mcp/call', async (req, res) => {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/mcp/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'MCP 服务不可用' });
  }
});

// MCP 资源获取
app.get('/api/mcp/resources/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const response = await fetch(`${MCP_SERVER_URL}/mcp/resources/${type}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'MCP 服务不可用' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '..', '..', 'dist', 'chat.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📱 聊天页面：http://localhost:${PORT}/chat.html`);
  console.log(`🤖 AI 服务：${SILICONFLOW_API_URL}`);
  console.log(`🔧 MCP 服务：${MCP_SERVER_URL}`);
  console.log(`📝 使用模型：${SILICONFLOW_MODEL}`);
});

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// SiliconFlow AI 配置
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || 'YOUR_API_KEY';
const SILICONFLOW_MODEL = 'Pro/zai-org/GLM-4.7';

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '..', '..', 'dist')));

app.post('/api/chat', async (req, res) => {
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
          { role: 'system', content: '你是一个专业的邮件分析助手。请用清晰、结构化的格式回复，使用适当的换行和分段，让内容易于阅读。对于重要信息可以使用加粗或列表形式呈现。' },
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

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '..', '..', 'dist', 'chat.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📱 聊天页面：http://localhost:${PORT}/chat.html`);
  console.log(`🤖 AI 服务：${SILICONFLOW_API_URL}`);
  console.log(`📝 使用模型：${SILICONFLOW_MODEL}`);
});

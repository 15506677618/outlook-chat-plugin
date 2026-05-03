import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 为 Node < 18 提供 fetch polyfill
if (!globalThis.fetch) {
  await import('node-fetch').then(module => {
    globalThis.fetch = module.default;
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
const envFile = process.env.NODE_ENV === 'production' ? 'prod.env' : 'local.env';
dotenv.config({ path: join(__dirname, '..', '..', envFile) });

const app = express();
const PORT = process.env.PORT || 3002; // 改为3002，避免与server-mcp.js冲突

// SiliconFlow AI 配置
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || 'YOUR_API_KEY';
const SILICONFLOW_MODEL = 'Pro/zai-org/GLM-4.7';

// 访问控制配置
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || 'koudai123';

// Mock 数据存储（用于本地测试）
const mockData = {
  inquiries: [],
  quotations: [],
  suppliers: [
    { id: 'S001', name: '上海远洋物流', contact: '张经理', phone: '13800138001', email: 'shanghai@oceanlogistics.com', address: '上海市浦东新区', products: ['海运', '空运', '仓储'], rating: 4.8 },
    { id: 'S002', name: '深圳速达供应链', contact: '李总监', phone: '13900139002', email: 'sz@suda-supply.com', address: '深圳市南山区', products: ['快递', '仓储', '报关'], rating: 4.5 },
    { id: 'S003', name: '宁波港务集团', contact: '王部长', phone: '13700137003', email: 'wang@nbport.com', address: '宁波市北仑区', products: ['港口服务', '集装箱', '拖车'], rating: 4.9 },
    { id: 'S004', name: '青岛海丰物流', contact: '赵经理', phone: '13600136004', email: 'zhao@haifeng-logistics.com', address: '青岛市黄岛区', products: ['海运', '拼箱', '报关'], rating: 4.6 },
    { id: 'S005', name: '厦门联合航运', contact: '陈主管', phone: '13500135005', email: 'chen@unishipping.com', address: '厦门市湖里区', products: ['海运', '空运', '货运代理'], rating: 4.7 },
  ]
};

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

// 受保护的 API 接口 - 流式输出
app.post('/api/chat', requirePassword, async (req, res) => {
  const { messages, userMessage, stream = true } = req.body;

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
          { role: 'system', content: '你是一个专业的邮件分析助手，帮助用户管理货运询价和报价。\n\n【重要规则】\n1. 分析邮件时，只提取邮件中**明确提到**的信息，不要猜测或编造\n2. 如果某个字段在邮件中没有提到，标注为"未提供"或留空\n3. 添加询价/报价记录时，必须严格按照邮件内容执行，不能产生幻觉\n4. 不确定的信息要告知用户，不要擅自填充\n\n【查询报价】\n当用户询问"查看 XXX 的报价"或"查询 XXX 的报价"时：\n1. 告诉用户你会在左侧面板显示该询价单的报价记录\n2. 不要说自己无法查询，系统会自动处理\n\n你可以使用 HTML 标签美化回复：<b>/<strong> 加粗、<br> 换行、<p> 段落、<ul>/<li> 列表、<h3> 标题等。' },
          ...messages
        ],
        stream: stream !== false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('AI API 错误:', response.status, errorData);
      throw new Error(`AI API 错误：${response.status}`);
    }

    // 如果是流式响应
    if (stream !== false && response.headers.get('content-type')?.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              res.write('data: [DONE]\n\n');
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      res.end();
    } else {
      // 非流式响应（兼容旧版本）
      const data = await response.json();
      const botReply = data.choices?.[0]?.message?.content || '抱歉，我没有理解。';

      res.json({
        response: botReply,
        message: botReply,
        timestamp: new Date().toISOString(),
        model: SILICONFLOW_MODEL
      });
    }

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

// MCP 工具列表（需要密码）
app.get('/api/mcp/tools', requirePassword, async (req, res) => {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/mcp/tools`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'MCP 服务不可用' });
  }
});

// MCP 工具调用（需要密码）
app.post('/api/mcp/call', requirePassword, async (req, res) => {
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

// MCP 资源获取（需要密码）
app.get('/api/mcp/resources/:type', requirePassword, async (req, res) => {
  try {
    const { type } = req.params;
    const response = await fetch(`${MCP_SERVER_URL}/mcp/resources/${type}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'MCP 服务不可用' });
  }
});

// ========== 询价记录相关路由 ==========

// 检查询价是否已存在
app.post('/api/mcp/check_inquiry_exists', requirePassword, async (req, res) => {
  try {
    const { messageId, userId } = req.body;
    
    // 直接查询数据库/mock数据（使用 messageId 匹配）
    const inquiry = mockData.inquiries.find(i => i.messageId === messageId || i.emailId === messageId);
    
    if (inquiry) {
      res.json({
        exists: true,
        inquiryId: inquiry.id,
        status: inquiry.status || 'inquiry'
      });
    } else {
      res.json({
        exists: false,
        inquiryId: null,
        status: null
      });
    }
  } catch (error) {
    res.status(500).json({ error: '检查失败', details: error.message });
  }
});

// 添加询价记录
app.post('/api/mcp/add_inquiry_record', requirePassword, async (req, res) => {
  try {
    const { userId, customerName, messageId, emailId, emailSubject, extractedData, completeness, status } = req.body;
    
    // 先检查是否已存在（防止重复添加）
    const existingInquiry = mockData.inquiries.find(i => 
      (messageId && i.messageId === messageId) || 
      (emailId && i.emailId === emailId)
    );
    
    if (existingInquiry) {
      return res.json({
        success: false,
        exists: true,
        inquiryId: existingInquiry.id,
        message: '该邮件已添加过询价记录',
        status: existingInquiry.status
      });
    }
    
    // 生成询价单号
    const year = new Date().getFullYear();
    const id = `INQ-${year}-${String(mockData.inquiries.length + 1).padStart(3, '0')}`;
    
    // 保存到 mockData
    const newInquiry = {
      id,
      userId,
      customerName,
      messageId,
      emailId,
      emailSubject,
      ...extractedData,
      completeness,
      status: status || 'draft',
      createdBy: userId,
      createdAt: new Date().toISOString()
    };
    mockData.inquiries.push(newInquiry);
    
    res.json({
      success: true,
      inquiryId: id,
      message: `询价记录已添加，单号：${id}`
    });
  } catch (error) {
    res.status(500).json({ error: '添加失败', details: error.message });
  }
});

// 搜索询价单（支持分页）
app.post('/api/mcp/search_inquiries', requirePassword, async (req, res) => {
  try {
    const { userId, keyword, page = 1, pageSize = 10 } = req.body;
    
    // 从 mockData 中搜索
    let results = mockData.inquiries.filter(i => i.userId === userId);
    
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      results = results.filter(i => 
        i.id.toLowerCase().includes(lowerKeyword) ||
        (i.pol && i.pol.toLowerCase().includes(lowerKeyword)) ||
        (i.pod && i.pod.toLowerCase().includes(lowerKeyword)) ||
        (i.cargoName && i.cargoName.toLowerCase().includes(lowerKeyword))
      );
    }
    
    // 分页处理
    const total = results.length;
    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const paginatedResults = results.slice(startIdx, endIdx);
    
    res.json({ 
      inquiries: paginatedResults,
      total: total,
      page: page,
      pageSize: pageSize
    });
  } catch (error) {
    res.status(500).json({ error: '搜索失败', details: error.message });
  }
});

// 获取当前用户的询价记录
app.post('/api/mcp/get_my_inquiries', requirePassword, async (req, res) => {
  try {
    const { userId } = req.body;
    
    // 从 mockData 中获取
    const results = mockData.inquiries.filter(i => i.userId === userId);
    
    res.json({ inquiries: results });
  } catch (error) {
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// ========== 报价记录相关路由 ==========

// 添加报价记录
app.post('/api/mcp/add_quotation_record', requirePassword, async (req, res) => {
  try {
    const { userId, inquiryId, supplierId, supplierName, extractedData } = req.body;
    
    // 生成报价单号
    const year = new Date().getFullYear();
    const id = `QUO-${year}-${String(mockData.quotations.length + 1).padStart(3, '0')}`;
    
    // 保存到 mockData
    const newQuotation = {
      id,
      userId,
      inquiryId,
      supplierId,
      supplierName,
      ...extractedData,
      createdBy: userId,
      createdAt: new Date().toISOString()
    };
    mockData.quotations.push(newQuotation);
    
    res.json({
      success: true,
      quotationId: id,
      message: `报价记录已添加，单号：${id}`
    });
  } catch (error) {
    res.status(500).json({ error: '添加失败', details: error.message });
  }
});

// 搜索供应商（支持分页）
app.post('/api/mcp/search_supplier', requirePassword, async (req, res) => {
  try {
    const { keyword, page = 1, pageSize = 10 } = req.body;
    
    // 从 mockData 中搜索
    let results = mockData.suppliers;
    
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      results = results.filter(s => 
        s.name.toLowerCase().includes(lowerKeyword) || 
        s.email.toLowerCase().includes(lowerKeyword) || 
        s.phone.includes(lowerKeyword) ||
        s.contact.toLowerCase().includes(lowerKeyword)
      );
    }
    
    // 分页处理
    const total = results.length;
    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const paginatedResults = results.slice(startIdx, endIdx);
    
    res.json({ 
      suppliers: paginatedResults,
      total: total,
      page: page,
      pageSize: pageSize
    });
  } catch (error) {
    res.status(500).json({ error: '搜索失败', details: error.message });
  }
});

// 查询报价记录（按询价单号）
app.post('/api/mcp/get_quotations_by_inquiry', requirePassword, async (req, res) => {
  try {
    const { inquiryId, userId } = req.body;
    
    // 从 mockData 中查询
    let results = mockData.quotations.filter(q => q.inquiryId === inquiryId);
    
    // 如果不是管理员，只显示自己的数据
    if (userId && userId !== 'admin') {
      results = results.filter(q => q.userId === userId);
    }
    
    // 按创建时间排序（最新的在前）
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ 
      success: true,
      quotations: results,
      count: results.length
    });
  } catch (error) {
    res.status(500).json({ error: '查询失败', details: error.message });
  }
});

// 查询所有报价记录（当前用户）
app.post('/api/mcp/get_my_quotations', requirePassword, async (req, res) => {
  try {
    const { userId } = req.body;
    
    // 从 mockData 中查询
    let results = mockData.quotations.filter(q => q.userId === userId);
    
    // 按创建时间排序（最新的在前）
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ 
      success: true,
      quotations: results,
      count: results.length
    });
  } catch (error) {
    res.status(500).json({ error: '查询失败', details: error.message });
  }
});

app.get('/api/user/info', (req, res) => {
  res.json({
    userId: process.env.DEFAULT_USER_ID || 'demo_user',
    userName: process.env.DEFAULT_USER_NAME || '演示用户',
    enableMockEmail: process.env.ENABLE_MOCK_EMAIL === 'true'
  });
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

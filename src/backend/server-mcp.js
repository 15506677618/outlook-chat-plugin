import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// 为 Node < 18 提供 fetch polyfill
if (!globalThis.fetch) {
  const module = await import('node-fetch');
  globalThis.fetch = module.default;
}

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

// MCP 服务器配置
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '..', '..', 'dist')));

// MCP 客户端函数
async function listMCPTools() {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/mcp/tools`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.tools;
  } catch (error) {
    console.error('MCP Error:', error.message);
    return [];
  }
}

async function callMCPTool(toolName, parameters) {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/mcp/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: toolName, parameters })
    });
    if (!response.ok) throw new Error('Tool call failed');
    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('MCP Tool Error:', error.message);
    return { error: error.message };
  }
}

// 生成 MCP 工具描述
async function generateMCPDescription() {
  const tools = await listMCPTools();
  if (tools.length === 0) return '';
  
  let description = '\n\n你可以使用以下 MCP 工具来获取实时数据:\n\n';
  
  tools.forEach(tool => {
    description += `【${tool.name}】${tool.description}\n`;
    if (Object.keys(tool.parameters).length > 0) {
      description += '参数: ';
      const params = Object.entries(tool.parameters).map(([key, value]) => {
        return `${key}(${value.description})${value.enum ? `[${value.enum.join('/')}]` : ''}`;
      });
      description += params.join(', ') + '\n';
    }
    description += '\n';
  });
  
  description += '当你需要使用工具时，请在回复中使用以下格式:\n';
  description += '【工具调用】{"tool": "工具名", "parameters": {"参数名": "参数值"}}【/工具调用】\n\n';
  description += '系统会自动执行工具调用并将结果返回给你。';
  
  return description;
}

// 解析工具调用 - 支持多种格式
function parseToolCalls(text) {
  const toolCalls = [];
  
  // 格式1: 【工具调用】...【/工具调用】
  let startTag = '【工具调用】';
  let endTag = '【/工具调用】';
  let searchFrom = 0;
  
  while (searchFrom < text.length) {
    const startIdx = text.indexOf(startTag, searchFrom);
    if (startIdx === -1) break;
    
    const endIdx = text.indexOf(endTag, startIdx + startTag.length);
    if (endIdx === -1) break;
    
    const jsonStr = text.substring(startIdx + startTag.length, endIdx).trim();
    
    try {
      // 尝试提取完整的JSON对象（处理嵌套括号）
      const toolCall = extractJSON(jsonStr);
      if (toolCall && toolCall.tool && toolCall.parameters !== undefined) {
        toolCalls.push(toolCall);
      }
    } catch (e) {
      console.error('Parse tool call error:', jsonStr.substring(0, 100));
    }
    
    searchFrom = endIdx + endTag.length;
  }
  
  // 格式2: [TOOL_CALL]...[/TOOL_CALL]
  searchFrom = 0;
  startTag = '[TOOL_CALL]';
  endTag = '[/TOOL_CALL]';
  
  while (searchFrom < text.length) {
    const startIdx = text.indexOf(startTag, searchFrom);
    if (startIdx === -1) break;
    
    const endIdx = text.indexOf(endTag, startIdx + startTag.length);
    if (endIdx === -1) break;
    
    const jsonStr = text.substring(startIdx + startTag.length, endIdx).trim();
    
    try {
      const toolCall = extractJSON(jsonStr);
      if (toolCall && toolCall.tool && toolCall.parameters !== undefined) {
        toolCalls.push(toolCall);
      }
    } catch (e) {
      console.error('Parse tool call error:', jsonStr.substring(0, 100));
    }
    
    searchFrom = endIdx + endTag.length;
  }
  
  return toolCalls;
}

// 提取完整的JSON对象（处理嵌套的大括号）
function extractJSON(str) {
  str = str.trim();
  if (!str.startsWith('{')) {
    // 如果不是以{开头，尝试找到第一个{
    const firstBrace = str.indexOf('{');
    if (firstBrace === -1) throw new Error('No JSON object found');
    str = str.substring(firstBrace);
  }
  
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      
      if (braceCount === 0) {
        // 找到匹配的结束括号
        const jsonStr = str.substring(0, i + 1);
        return JSON.parse(jsonStr);
      }
    }
  }
  
  throw new Error('Incomplete JSON object');
}

// 执行工具调用
async function executeToolCalls(toolCalls) {
  const results = [];
  
  for (const toolCall of toolCalls) {
    console.log(`Executing tool: ${toolCall.tool}`, toolCall.parameters);
    const result = await callMCPTool(toolCall.tool, toolCall.parameters);
    results.push({
      tool: toolCall.tool,
      parameters: toolCall.parameters,
      result
    });
  }
  
  return results;
}

// 聊天接口
app.post('/api/chat', async (req, res) => {
  const { messages, userMessage } = req.body;

  try {
    // 获取 MCP 工具描述
    const mcpDescription = await generateMCPDescription();
    
    // 构建系统提示
    const systemPrompt = `你是一个专业的邮件分析助手，同时也是一个货运物流专家。你可以使用 HTML 标签来美化回复内容。

你可以：
1. 分析邮件内容，提取关键信息
2. 回答关于货运、物流的问题
3. 使用 MCP 工具获取实时数据${mcpDescription}

使用 HTML 标签让回复更美观：<b>加粗</b>、<br>换行、<p>段落、<ul>/<li>列表等。`;

    // 调用 AI
    const response = await fetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`
      },
      body: JSON.stringify({
        model: SILICONFLOW_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
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
    let botReply = data.choices?.[0]?.message?.content || '抱歉，我没有理解。';

    // 检查是否有工具调用
    const toolCalls = parseToolCalls(botReply);
    
    if (toolCalls.length > 0) {
      // 执行工具调用
      const toolResults = await executeToolCalls(toolCalls);
      
      // 将工具结果添加到对话中
      const toolResultsText = toolResults.map(tr => {
        return `工具【${tr.tool}】执行结果:\n${JSON.stringify(tr.result, null, 2)}`;
      }).join('\n\n');
      
      // 再次调用 AI，让 AI 基于工具结果生成回复
      const followUpResponse = await fetch(SILICONFLOW_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SILICONFLOW_API_KEY}`
        },
        body: JSON.stringify({
          model: SILICONFLOW_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
            { role: 'assistant', content: botReply },
            { role: 'system', content: `工具执行结果:\n${toolResultsText}\n\n请基于以上工具结果，用中文回复用户。` }
          ]
        })
      });
      
      if (followUpResponse.ok) {
        const followUpData = await followUpResponse.json();
        botReply = followUpData.choices?.[0]?.message?.content || botReply;
      }
    }

    res.json({
      response: botReply,
      message: botReply,
      timestamp: new Date().toISOString(),
      model: SILICONFLOW_MODEL
    });

  } catch (error) {
    console.error('Chat 错误:', error);
    
    const botReply = `服务暂时不可用：${error.message}`;
    
    res.json({
      response: botReply,
      message: botReply,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// MCP 代理接口（前端直接调用）
app.get('/api/mcp/tools', async (req, res) => {
  const tools = await listMCPTools();
  res.json({ tools });
});

app.post('/api/mcp/call', async (req, res) => {
  const { tool, parameters } = req.body;
  const result = await callMCPTool(tool, parameters);
  res.json({ result });
});

app.get('/api/mcp/resources/:type', async (req, res) => {
  const { type } = req.params;
  try {
    const response = await fetch(`${MCP_SERVER_URL}/mcp/resources/${type}`);
    if (!response.ok) throw new Error(`Failed to fetch ${type}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('MCP Resource Error:', error.message);
    res.status(500).json({ error: error.message });
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

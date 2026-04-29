// MCP 客户端 - 用于与 MCP 服务器通信

const MCP_SERVER_URL = 'http://localhost:3001';

// 获取所有可用工具
async function listTools() {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/mcp/tools`);
    if (!response.ok) throw new Error('Failed to fetch tools');
    const data = await response.json();
    return data.tools;
  } catch (error) {
    console.error('Error listing tools:', error);
    return [];
  }
}

// 调用 MCP 工具
async function callTool(toolName, parameters) {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/mcp/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: toolName, parameters })
    });
    if (!response.ok) throw new Error('Failed to call tool');
    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Error calling tool:', error);
    return { error: error.message };
  }
}

// 获取资源
async function getResource(type) {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/mcp/resources/${type}`);
    if (!response.ok) throw new Error('Failed to fetch resource');
    return await response.json();
  } catch (error) {
    console.error('Error getting resource:', error);
    return null;
  }
}

// 生成工具描述文本（用于系统提示）
async function generateToolDescription() {
  const tools = await listTools();
  
  let description = '你可以使用以下工具来获取信息:\n\n';
  
  tools.forEach(tool => {
    description += `工具: ${tool.name}\n`;
    description += `描述: ${tool.description}\n`;
    if (Object.keys(tool.parameters).length > 0) {
      description += '参数:\n';
      for (const [key, value] of Object.entries(tool.parameters)) {
        description += `  - ${key}: ${value.description}${value.enum ? ` (可选值: ${value.enum.join(', ')})` : ''}\n`;
      }
    }
    description += '\n';
  });
  
  description += '当你需要调用工具时，请在回复中使用以下格式:\n';
  description += '[TOOL_CALL] {"tool": "工具名", "parameters": {"参数名": "参数值"}} [/TOOL_CALL]\n\n';
  description += '我会执行工具调用并将结果返回给你。';
  
  return description;
}

// 解析 AI 回复中的工具调用
function parseToolCalls(text) {
  const toolCalls = [];
  const regex = /\[TOOL_CALL\]\s*(\{[\s\S]*?\})\s*\[\/TOOL_CALL\]/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    try {
      const toolCall = JSON.parse(match[1]);
      toolCalls.push(toolCall);
    } catch (e) {
      console.error('Failed to parse tool call:', match[1]);
    }
  }
  
  return toolCalls;
}

// 执行工具调用并返回结果
async function executeToolCalls(toolCalls) {
  const results = [];
  
  for (const toolCall of toolCalls) {
    const result = await callTool(toolCall.tool, toolCall.parameters);
    results.push({
      tool: toolCall.tool,
      parameters: toolCall.parameters,
      result
    });
  }
  
  return results;
}

export {
  listTools,
  callTool,
  getResource,
  generateToolDescription,
  parseToolCalls,
  executeToolCalls
};

# Mock MCP Server

这是一个模拟的 MCP (Model Context Protocol) 服务器，用于货运物流场景。

## 功能

### 提供的工具

1. **get_shipment_status** - 获取货运状态
   - 参数: `shipmentId` (货运单号)
   - 示例: SH001, SH002, SH003

2. **get_shipping_rate** - 获取海运报价
   - 参数: `origin` (起运港), `destination` (目的港), `type` (FCL/LCL)
   - 示例路线: Shanghai-Los Angeles, Shenzhen-Rotterdam, Ningbo-Hamburg

3. **list_all_shipments** - 列出所有货运订单
   - 无参数

4. **get_customer_info** - 获取客户信息
   - 参数: `customerId` (客户ID)
   - 示例: C001, C002, C003

5. **calculate_freight_cost** - 计算运费
   - 参数: `origin`, `destination`, `type`, `volume`/`containerCount`

### 提供的资源

- `freight://shipments` - 所有货运订单
- `freight://rates` - 海运报价表
- `freight://customers` - 客户列表

## 启动方式

### 1. HTTP 模式（推荐）

```bash
cd mcp-server
npm install
node http-server.js
```

服务启动在 http://localhost:3001

### 2. Stdio 模式

```bash
cd mcp-server
npm install
node server.js
```

## 测试

```bash
# 获取工具列表
curl http://localhost:3001/mcp/tools

# 调用工具
curl -X POST http://localhost:3001/mcp/call \
  -H "Content-Type: application/json" \
  -d '{"tool": "get_shipment_status", "parameters": {"shipmentId": "SH001"}}'

# 获取资源
curl http://localhost:3001/mcp/resources/shipments
```

## 与 AI 集成

主服务器 (`server-mcp.js`) 已集成 MCP 客户端，AI 可以：

1. 自动发现可用的 MCP 工具
2. 在回复中使用 `【工具调用】{"tool": "...", "parameters": {...}}【/工具调用】` 格式调用工具
3. 系统自动执行工具并将结果返回给 AI
4. AI 基于工具结果生成最终回复

### 使用示例

用户问: "查询 SH001 的货运状态"

AI 回复: "我来帮您查询...【工具调用】{"tool": "get_shipment_status", "parameters": {"shipmentId": "SH001"}}【/工具调用】"

系统执行工具调用，然后将结果返回给 AI

AI 最终回复: "SH001 的货运状态是: In Transit，预计 2024-05-20 到达"

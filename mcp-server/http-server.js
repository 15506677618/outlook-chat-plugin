import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// Mock 数据存储
const mockData = {
  shipments: [
    { id: 'SH001', from: 'Shanghai', to: 'Los Angeles', status: 'In Transit', eta: '2024-05-20' },
    { id: 'SH002', from: 'Shenzhen', to: 'Rotterdam', status: 'Delivered', eta: '2024-05-15' },
    { id: 'SH003', from: 'Ningbo', to: 'Hamburg', status: 'Pending', eta: '2024-05-25' },
  ],
  rates: {
    'Shanghai-Los Angeles': { fcl: 3200, lcl: 45 },
    'Shenzhen-Rotterdam': { fcl: 2800, lcl: 38 },
    'Ningbo-Hamburg': { fcl: 3000, lcl: 42 },
  },
  customers: [
    { id: 'C001', name: 'ABC Trading', email: 'abc@example.com', country: 'USA' },
    { id: 'C002', name: 'XYZ Logistics', email: 'xyz@example.com', country: 'Germany' },
    { id: 'C003', name: 'Global Freight', email: 'global@example.com', country: 'Netherlands' },
  ]
};

// 工具定义
const tools = [
  {
    name: 'get_shipment_status',
    description: '获取货运状态信息',
    parameters: {
      shipmentId: { type: 'string', description: '货运单号' },
    },
    handler: ({ shipmentId }) => {
      const shipment = mockData.shipments.find(s => s.id === shipmentId);
      if (!shipment) return { error: `未找到货运单号: ${shipmentId}` };
      return {
        shipmentId: shipment.id,
        route: `${shipment.from} → ${shipment.to}`,
        status: shipment.status,
        eta: shipment.eta
      };
    }
  },
  {
    name: 'get_shipping_rate',
    description: '获取海运报价',
    parameters: {
      origin: { type: 'string', description: '起运港' },
      destination: { type: 'string', description: '目的港' },
      type: { type: 'string', enum: ['FCL', 'LCL'], description: '运输类型' },
    },
    handler: ({ origin, destination, type }) => {
      const route = `${origin}-${destination}`;
      const rate = mockData.rates[route];
      if (!rate) return { error: `未找到 ${route} 的报价信息` };
      const price = type === 'FCL' ? rate.fcl : rate.lcl;
      return {
        route,
        type,
        price,
        unit: type === 'FCL' ? '/柜' : '/CBM'
      };
    }
  },
  {
    name: 'list_all_shipments',
    description: '列出所有货运订单',
    parameters: {},
    handler: () => mockData.shipments
  },
  {
    name: 'get_customer_info',
    description: '获取客户信息',
    parameters: {
      customerId: { type: 'string', description: '客户ID' },
    },
    handler: ({ customerId }) => {
      const customer = mockData.customers.find(c => c.id === customerId);
      if (!customer) return { error: `未找到客户: ${customerId}` };
      return customer;
    }
  },
  {
    name: 'calculate_freight_cost',
    description: '计算运费',
    parameters: {
      origin: { type: 'string', description: '起运港' },
      destination: { type: 'string', description: '目的港' },
      type: { type: 'string', enum: ['FCL', 'LCL'], description: '运输类型' },
      volume: { type: 'number', description: '体积(CBM) - LCL时使用' },
      containerCount: { type: 'number', description: '集装箱数量 - FCL时使用' },
    },
    handler: ({ origin, destination, type, volume, containerCount }) => {
      const routeKey = `${origin}-${destination}`;
      const rate = mockData.rates[routeKey];
      if (!rate) return { error: `未找到 ${routeKey} 的报价信息` };
      
      let totalCost;
      if (type === 'FCL') {
        const count = containerCount || 1;
        totalCost = rate.fcl * count;
      } else {
        const vol = volume || 1;
        totalCost = rate.lcl * vol;
      }
      
      return {
        route: routeKey,
        type,
        totalCost,
        currency: 'USD'
      };
    }
  },
];

// API 路由

// 获取所有工具列表
app.get('/mcp/tools', (req, res) => {
  res.json({
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }))
  });
});

// 调用工具
app.post('/mcp/call', (req, res) => {
  const { tool, parameters } = req.body;
  
  const toolDef = tools.find(t => t.name === tool);
  if (!toolDef) {
    return res.status(404).json({ error: `未知工具: ${tool}` });
  }
  
  try {
    const result = toolDef.handler(parameters || {});
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取资源
app.get('/mcp/resources/:type', (req, res) => {
  const { type } = req.params;
  
  switch (type) {
    case 'shipments':
      res.json(mockData.shipments);
      break;
    case 'rates':
      res.json(mockData.rates);
      break;
    case 'customers':
      res.json(mockData.customers);
      break;
    default:
      res.status(404).json({ error: `未知资源类型: ${type}` });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mock-mcp-server', version: '1.0.0' });
});

app.listen(PORT, () => {
  console.log(`🚀 Mock MCP HTTP Server running on http://localhost:${PORT}`);
  console.log(`📋 工具列表: http://localhost:${PORT}/mcp/tools`);
  console.log(`📦 货运订单: http://localhost:${PORT}/mcp/resources/shipments`);
});

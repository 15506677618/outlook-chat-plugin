import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

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

// 创建 MCP 服务器
const server = new Server(
  {
    name: 'mock-freight-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// 定义工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_shipment_status',
        description: '获取货运状态信息',
        inputSchema: {
          type: 'object',
          properties: {
            shipmentId: {
              type: 'string',
              description: '货运单号',
            },
          },
          required: ['shipmentId'],
        },
      },
      {
        name: 'get_shipping_rate',
        description: '获取海运报价',
        inputSchema: {
          type: 'object',
          properties: {
            origin: {
              type: 'string',
              description: '起运港',
            },
            destination: {
              type: 'string',
              description: '目的港',
            },
            type: {
              type: 'string',
              enum: ['FCL', 'LCL'],
              description: '运输类型：FCL(整箱) 或 LCL(拼箱)',
            },
          },
          required: ['origin', 'destination', 'type'],
        },
      },
      {
        name: 'list_all_shipments',
        description: '列出所有货运订单',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_customer_info',
        description: '获取客户信息',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: {
              type: 'string',
              description: '客户ID',
            },
          },
          required: ['customerId'],
        },
      },
      {
        name: 'calculate_freight_cost',
        description: '计算运费',
        inputSchema: {
          type: 'object',
          properties: {
            origin: {
              type: 'string',
              description: '起运港',
            },
            destination: {
              type: 'string',
              description: '目的港',
            },
            type: {
              type: 'string',
              enum: ['FCL', 'LCL'],
              description: '运输类型',
            },
            volume: {
              type: 'number',
              description: '体积(CBM) - LCL 时使用',
            },
            containerCount: {
              type: 'number',
              description: '集装箱数量 - FCL 时使用',
            },
          },
          required: ['origin', 'destination', 'type'],
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_shipment_status': {
        const shipment = mockData.shipments.find(s => s.id === args.shipmentId);
        if (!shipment) {
          return {
            content: [{ type: 'text', text: `未找到货运单号: ${args.shipmentId}` }],
            isError: true,
          };
        }
        return {
          content: [{
            type: 'text',
            text: `货运单号: ${shipment.id}\n路线: ${shipment.from} → ${shipment.to}\n状态: ${shipment.status}\n预计到达: ${shipment.eta}`
          }],
        };
      }

      case 'get_shipping_rate': {
        const route = `${args.origin}-${args.destination}`;
        const rate = mockData.rates[route];
        if (!rate) {
          return {
            content: [{ type: 'text', text: `未找到 ${route} 的报价信息` }],
            isError: true,
          };
        }
        const price = args.type === 'FCL' ? rate.fcl : rate.lcl;
        return {
          content: [{
            type: 'text',
            text: `路线: ${route}\n运输类型: ${args.type}\n价格: $${price} ${args.type === 'FCL' ? '/柜' : '/CBM'}`
          }],
        };
      }

      case 'list_all_shipments': {
        const list = mockData.shipments.map(s => 
          `${s.id}: ${s.from} → ${s.to} (${s.status})`
        ).join('\n');
        return {
          content: [{ type: 'text', text: `所有货运订单:\n${list}` }],
        };
      }

      case 'get_customer_info': {
        const customer = mockData.customers.find(c => c.id === args.customerId);
        if (!customer) {
          return {
            content: [{ type: 'text', text: `未找到客户: ${args.customerId}` }],
            isError: true,
          };
        }
        return {
          content: [{
            type: 'text',
            text: `客户ID: ${customer.id}\n名称: ${customer.name}\n邮箱: ${customer.email}\n国家: ${customer.country}`
          }],
        };
      }

      case 'calculate_freight_cost': {
        const routeKey = `${args.origin}-${args.destination}`;
        const routeRate = mockData.rates[routeKey];
        if (!routeRate) {
          return {
            content: [{ type: 'text', text: `未找到 ${routeKey} 的报价信息` }],
            isError: true,
          };
        }
        
        let totalCost;
        if (args.type === 'FCL') {
          const count = args.containerCount || 1;
          totalCost = routeRate.fcl * count;
        } else {
          const vol = args.volume || 1;
          totalCost = routeRate.lcl * vol;
        }
        
        return {
          content: [{
            type: 'text',
            text: `运费计算:\n路线: ${routeKey}\n类型: ${args.type}\n总费用: $${totalCost}`
          }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `未知工具: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `执行错误: ${error.message}` }],
      isError: true,
    };
  }
});

// 定义资源
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'freight://shipments',
        name: '所有货运订单',
        mimeType: 'application/json',
        description: '获取所有货运订单列表',
      },
      {
        uri: 'freight://rates',
        name: '海运报价表',
        mimeType: 'application/json',
        description: '获取所有路线的海运报价',
      },
      {
        uri: 'freight://customers',
        name: '客户列表',
        mimeType: 'application/json',
        description: '获取所有客户信息',
      },
    ],
  };
});

// 处理资源读取
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'freight://shipments':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(mockData.shipments, null, 2),
        }],
      };
    case 'freight://rates':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(mockData.rates, null, 2),
        }],
      };
    case 'freight://customers':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(mockData.customers, null, 2),
        }],
      };
    default:
      throw new Error(`未知资源: ${uri}`);
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Mock MCP Server running on stdio');
}

main().catch(console.error);

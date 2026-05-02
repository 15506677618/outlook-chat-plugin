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
  ],
  suppliers: [
    { id: 'S001', name: '上海远洋物流', contact: '张经理', phone: '13800138001', email: 'shanghai@oceanlogistics.com', address: '上海市浦东新区', products: ['海运', '空运', '仓储'], rating: 4.8 },
    { id: 'S002', name: '深圳速达供应链', contact: '李总监', phone: '13900139002', email: 'sz@suda-supply.com', address: '深圳市南山区', products: ['快递', '仓储', '报关'], rating: 4.5 },
    { id: 'S003', name: '宁波港务集团', contact: '王部长', phone: '13700137003', email: 'wang@nbport.com', address: '宁波市北仑区', products: ['港口服务', '集装箱', '拖车'], rating: 4.9 },
    { id: 'S004', name: '青岛海丰物流', contact: '赵经理', phone: '13600136004', email: 'zhao@haifeng-logistics.com', address: '青岛市黄岛区', products: ['海运', '拼箱', '报关'], rating: 4.6 },
    { id: 'S005', name: '厦门联合航运', contact: '陈主管', phone: '13500135005', email: 'chen@unishipping.com', address: '厦门市湖里区', products: ['海运', '空运', '货运代理'], rating: 4.7 },
  ],
  inquiries: [
    { id: 'INQ-2024-001', customerId: 'C001', customerName: 'ABC Trading', emailId: 'email-001', emailSubject: '询价：上海到洛杉矶电子产品', inquiryDate: '2024-05-10', pol: 'Shanghai', pod: 'Los Angeles', cargoName: 'Electronics', containerType: '1x40HQ', volume: 60, weight: 18000, etd: '2024-06-01', specialRequirements: '需要温控' },
    { id: 'INQ-2024-002', customerId: 'C002', customerName: 'XYZ Logistics', emailId: 'email-002', emailSubject: '询价：深圳到鹿特丹机械设备', inquiryDate: '2024-05-12', pol: 'Shenzhen', pod: 'Rotterdam', cargoName: 'Machinery', containerType: '2x20GP', volume: 40, weight: 24000, etd: '2024-06-15', specialRequirements: '' },
  ],
  quotations: [
    { id: 'QUO-2024-001', inquiryId: 'INQ-2024-001', supplierId: 'S001', supplierName: '上海远洋物流', emailId: 'email-003', quoteDate: '2024-05-11', pol: 'Shanghai', pod: 'Los Angeles', ofRate: 3200, localCharges: 450, containerType: '1x40HQ', validDate: '2024-06-30', transitTime: '14 days', vesselName: 'MSC Leo', remarks: '价格最优' },
    { id: 'QUO-2024-002', inquiryId: 'INQ-2024-001', supplierId: 'S003', supplierName: '宁波港务集团', emailId: 'email-004', quoteDate: '2024-05-12', pol: 'Shanghai', pod: 'Los Angeles', ofRate: 3350, localCharges: 420, containerType: '1x40HQ', validDate: '2024-06-25', transitTime: '16 days', vesselName: 'COSCO Star', remarks: '' },
    { id: 'QUO-2024-003', inquiryId: 'INQ-2024-001', supplierId: 'S005', supplierName: '厦门联合航运', emailId: 'email-005', quoteDate: '2024-05-13', pol: 'Shanghai', pod: 'Los Angeles', ofRate: 3500, localCharges: 480, containerType: '1x40HQ', validDate: '2024-07-05', transitTime: '15 days', vesselName: 'MSK Ocean', remarks: '' },
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
      {
        name: 'get_supplier_info',
        description: '获取供应商信息',
        inputSchema: {
          type: 'object',
          properties: {
            supplierId: {
              type: 'string',
              description: '供应商ID',
            },
          },
          required: ['supplierId'],
        },
      },
      {
        name: 'list_all_suppliers',
        description: '列出所有供应商',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'search_suppliers_by_product',
        description: '按产品/服务搜索供应商',
        inputSchema: {
          type: 'object',
          properties: {
            product: {
              type: 'string',
              description: '产品/服务名称',
            },
          },
          required: ['product'],
        },
      },
      {
        name: 'get_top_rated_suppliers',
        description: '获取评分最高的供应商',
        inputSchema: {
          type: 'object',
          properties: {
            minRating: {
              type: 'number',
              description: '最低评分 (默认4.5)',
            },
          },
        },
      },
      {
        name: 'add_inquiry_record',
        description: '添加询价记录',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: { type: 'string', description: '客户ID' },
            customerName: { type: 'string', description: '客户名称' },
            emailId: { type: 'string', description: '邮件ID' },
            emailSubject: { type: 'string', description: '邮件主题' },
            inquiryDate: { type: 'string', description: '询价日期' },
            pol: { type: 'string', description: '起运港' },
            pod: { type: 'string', description: '目的港' },
            cargoName: { type: 'string', description: '货物品名' },
            containerType: { type: 'string', description: '箱型' },
            volume: { type: 'number', description: '体积(CBM)' },
            weight: { type: 'number', description: '重量(KG)' },
            etd: { type: 'string', description: '预计出货时间' },
            specialRequirements: { type: 'string', description: '特殊要求' },
          },
        },
      },
      {
        name: 'add_quotation_record',
        description: '添加报价记录',
        inputSchema: {
          type: 'object',
          properties: {
            inquiryId: { type: 'string', description: '关联询价单号' },
            supplierId: { type: 'string', description: '供应商ID' },
            supplierName: { type: 'string', description: '供应商名称' },
            emailId: { type: 'string', description: '邮件ID' },
            quoteDate: { type: 'string', description: '报价日期' },
            pol: { type: 'string', description: '起运港' },
            pod: { type: 'string', description: '目的港' },
            ofRate: { type: 'number', description: '海运费' },
            localCharges: { type: 'number', description: '本地费' },
            containerType: { type: 'string', description: '箱型' },
            validDate: { type: 'string', description: '有效期' },
            transitTime: { type: 'string', description: '运输时间' },
            vesselName: { type: 'string', description: '船名' },
            remarks: { type: 'string', description: '备注' },
          },
          required: ['inquiryId', 'supplierId'],
        },
      },
      {
        name: 'search_supplier',
        description: '搜索供应商',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: { type: 'string', description: '搜索关键词' },
            emailDomain: { type: 'string', description: '邮箱域名' },
          },
        },
      },
      {
        name: 'search_inquiry',
        description: '搜索询价记录',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: { type: 'string', description: '搜索关键词（客户名/询价单号/货物品名）' },
            pol: { type: 'string', description: '起运港（可选）' },
            pod: { type: 'string', description: '目的港（可选）' },
          },
        },
      },
      {
        name: 'get_quotations_by_inquiry',
        description: '获取询价的所有报价',
        inputSchema: {
          type: 'object',
          properties: {
            inquiryId: { type: 'string', description: '询价单号' },
          },
          required: ['inquiryId'],
        },
      },
      {
        name: 'get_quotations_by_supplier',
        description: '获取供应商的所有报价',
        inputSchema: {
          type: 'object',
          properties: {
            supplierId: { type: 'string', description: '供应商ID' },
            pol: { type: 'string', description: '起运港（可选）' },
            pod: { type: 'string', description: '目的港（可选）' },
          },
          required: ['supplierId'],
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

      case 'get_supplier_info': {
        const supplier = mockData.suppliers.find(s => s.id === args.supplierId);
        if (!supplier) {
          return {
            content: [{ type: 'text', text: `未找到供应商: ${args.supplierId}` }],
            isError: true,
          };
        }
        return {
          content: [{
            type: 'text',
            text: `供应商ID: ${supplier.id}\n名称: ${supplier.name}\n联系人: ${supplier.contact}\n电话: ${supplier.phone}\n邮箱: ${supplier.email}\n地址: ${supplier.address}\n产品/服务: ${supplier.products.join(', ')}\n评分: ${supplier.rating}`
          }],
        };
      }

      case 'list_all_suppliers': {
        const list = mockData.suppliers.map(s => 
          `${s.id}: ${s.name} (${s.contact}) - 评分: ${s.rating}`
        ).join('\n');
        return {
          content: [{ type: 'text', text: `所有供应商:\n${list}` }],
        };
      }

      case 'search_suppliers_by_product': {
        const results = mockData.suppliers.filter(s => 
          s.products.some(p => p.includes(args.product))
        );
        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: `未找到提供 ${args.product} 的供应商` }],
            isError: true,
          };
        }
        const list = results.map(s => 
          `${s.id}: ${s.name} - 产品: ${s.products.join(', ')} - 评分: ${s.rating}`
        ).join('\n');
        return {
          content: [{ type: 'text', text: `提供 ${args.product} 的供应商:\n${list}` }],
        };
      }

      case 'get_top_rated_suppliers': {
        const rating = args.minRating || 4.5;
        const results = mockData.suppliers
          .filter(s => s.rating >= rating)
          .sort((a, b) => b.rating - a.rating);
        const list = results.map(s => 
          `${s.id}: ${s.name} - 评分: ${s.rating} - 产品: ${s.products.join(', ')}`
        ).join('\n');
        return {
          content: [{ type: 'text', text: `评分≥${rating}的供应商:\n${list}` }],
        };
      }

      case 'add_inquiry_record': {
        const year = new Date().getFullYear();
        const id = `INQ-${year}-${String(mockData.inquiries.length + 1).padStart(3, '0')}`;
        const newInquiry = { id, ...args };
        mockData.inquiries.push(newInquiry);
        return {
          content: [{ type: 'text', text: `询价记录已添加\n询价单号: ${id}\n客户: ${args.customerName || '未指定'}\n路线: ${args.pol || ''} → ${args.pod || ''}` }],
        };
      }

      case 'add_quotation_record': {
        const inquiry = mockData.inquiries.find(i => i.id === args.inquiryId);
        if (!inquiry) {
          return {
            content: [{ type: 'text', text: `未找到询价单: ${args.inquiryId}` }],
            isError: true,
          };
        }
        
        const supplier = mockData.suppliers.find(s => s.id === args.supplierId);
        if (!supplier && args.supplierId) {
          return {
            content: [{ type: 'text', text: `未找到供应商: ${args.supplierId}` }],
            isError: true,
          };
        }
        
        const year = new Date().getFullYear();
        const id = `QUO-${year}-${String(mockData.quotations.length + 1).padStart(3, '0')}`;
        const newQuotation = { id, ...args };
        mockData.quotations.push(newQuotation);
        return {
          content: [{ type: 'text', text: `报价记录已添加\n报价单号: ${id}\n关联询价: ${args.inquiryId}\n供应商: ${args.supplierName || supplier?.name || '未指定'}\n海运费: $${args.ofRate || 0}` }],
        };
      }

      case 'search_supplier': {
        let results = mockData.suppliers;
        
        if (args.keyword) {
          results = results.filter(s => 
            s.name.includes(args.keyword) || 
            s.email.includes(args.keyword) || 
            s.phone.includes(args.keyword) ||
            s.contact.includes(args.keyword)
          );
        }
        
        if (args.emailDomain) {
          results = results.filter(s => s.email.includes(args.emailDomain));
        }
        
        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: `未找到匹配的供应商` }],
            isError: true,
          };
        }
        
        const list = results.map(s => 
          `${s.id}: ${s.name} - ${s.contact} - ${s.email}`
        ).join('\n');
        return {
          content: [{ type: 'text', text: `搜索结果:\n${list}` }],
        };
      }

      case 'search_inquiry': {
        let results = mockData.inquiries;
        
        if (args.keyword) {
          results = results.filter(i => 
            i.id.includes(args.keyword) || 
            i.customerName.includes(args.keyword) || 
            i.cargoName.includes(args.keyword) ||
            i.pol.includes(args.keyword) ||
            i.pod.includes(args.keyword)
          );
        }
        
        if (args.pol) {
          results = results.filter(i => i.pol && i.pol.includes(args.pol));
        }
        
        if (args.pod) {
          results = results.filter(i => i.pod && i.pod.includes(args.pod));
        }
        
        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: `未找到匹配的询价记录` }],
            isError: true,
          };
        }
        
        const list = results.map(i => 
          `${i.id}: ${i.customerName} - ${i.pol}→${i.pod} - ${i.cargoName} (${i.containerType})`
        ).join('\n');
        return {
          content: [{ type: 'text', text: `询价搜索结果:\n${list}` }],
        };
      }

      case 'get_quotations_by_inquiry': {
        const inquiry = mockData.inquiries.find(i => i.id === args.inquiryId);
        if (!inquiry) {
          return {
            content: [{ type: 'text', text: `未找到询价单: ${args.inquiryId}` }],
            isError: true,
          };
        }
        
        const quotations = mockData.quotations.filter(q => q.inquiryId === args.inquiryId);
        
        if (quotations.length === 0) {
          return {
            content: [{ type: 'text', text: `询价单 ${args.inquiryId} 暂无报价` }],
          };
        }
        
        const list = quotations.map(q => 
          `${q.id}: ${q.supplierName} - 海运费: $${q.ofRate} - 本地费: $${q.localCharges}`
        ).join('\n');
        
        return {
          content: [{ type: 'text', text: `询价单 ${args.inquiryId} (${inquiry.customerName}) 的报价:\n${list}` }],
        };
      }

      case 'get_quotations_by_supplier': {
        const supplier = mockData.suppliers.find(s => s.id === args.supplierId);
        if (!supplier) {
          return {
            content: [{ type: 'text', text: `未找到供应商: ${args.supplierId}` }],
            isError: true,
          };
        }
        
        let quotations = mockData.quotations.filter(q => q.supplierId === args.supplierId);
        
        if (args.pol) {
          quotations = quotations.filter(q => q.pol === args.pol);
        }
        if (args.pod) {
          quotations = quotations.filter(q => q.pod === args.pod);
        }
        
        if (quotations.length === 0) {
          return {
            content: [{ type: 'text', text: `供应商 ${supplier.name} 暂无报价记录` }],
          };
        }
        
        const list = quotations.map(q => 
          `${q.id}: ${q.pol} → ${q.pod} - 海运费: $${q.ofRate} - 有效期: ${q.validDate}`
        ).join('\n');
        
        return {
          content: [{ type: 'text', text: `供应商 ${supplier.name} 的报价记录:\n${list}` }],
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
      {
        uri: 'freight://suppliers',
        name: '供应商列表',
        mimeType: 'application/json',
        description: '获取所有供应商信息',
      },
      {
        uri: 'freight://inquiries',
        name: '询价记录',
        mimeType: 'application/json',
        description: '获取所有询价记录',
      },
      {
        uri: 'freight://quotations',
        name: '报价记录',
        mimeType: 'application/json',
        description: '获取所有报价记录',
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
    case 'freight://suppliers':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(mockData.suppliers, null, 2),
        }],
      };
    case 'freight://inquiries':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(mockData.inquiries, null, 2),
        }],
      };
    case 'freight://quotations':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(mockData.quotations, null, 2),
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

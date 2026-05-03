import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', 'local.env') });

const app = express();

// 配置 CORS，允许所有来源
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? ['https://koudai.xin', 'https://www.koudai.xin'] 
  : '*';
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 处理预检请求
app.options('*', cors());

app.use(express.json());

const PORT = 3001;

// 数据文件路径
const DATA_FILE = join(__dirname, 'data.json');

// 默认数据
const defaultData = {
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
    { id: 'INQ-2024-001', messageId: 'msg-001', userId: 'demo_user', customerName: 'ABC Trading', emailId: 'email-001', emailSubject: '询价：上海到洛杉矶电子产品', inquiryDate: '2024-05-10', pol: 'Shanghai', pod: 'Los Angeles', cargoName: 'Electronics', containerType: '1x40HQ', volume: 60, weight: 18000, etd: '2024-06-01', specialRequirements: '需要温控', completeness: 100, status: 'inquiry', createdBy: 'demo_user', createdAt: '2024-05-10T10:00:00Z' },
  ],
  quotations: [
    { id: 'QUO-2024-001', messageId: 'msg-002', userId: 'demo_user', inquiryId: 'INQ-2024-001', supplierId: 'S001', supplierName: '上海远洋物流', emailId: 'email-003', quoteDate: '2024-05-11', pol: 'Shanghai', pod: 'Los Angeles', ofRate: 3200, localCharges: 450, otherCharges: 0, totalCost: 3650, containerType: '1x40HQ', validDate: '2024-06-30', transitTime: '14 days', vesselName: 'MSC Leo', remarks: '价格最优', createdBy: 'demo_user', createdAt: '2024-05-11T10:00:00Z' },
  ]
};

// 加载数据
function loadData() {
  try {
    if (existsSync(DATA_FILE)) {
      const data = readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('加载数据失败:', error);
  }
  return defaultData;
}

// 保存数据
function saveData(data) {
  try {
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.warn('保存数据失败 (非致命):', error.message);
  }
}

// 初始化数据
const mockData = loadData();

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
  {
    name: 'add_inquiry_record',
    description: '添加询价记录（自动计算完整度）',
    parameters: {
      userId: { type: 'string', description: '当前用户ID' },
      messageId: { type: 'string', description: '邮件唯一标识（用于重复检查）' },
      emailId: { type: 'string', description: '邮件ID' },
      emailSubject: { type: 'string', description: '邮件主题' },
      emailContent: { type: 'string', description: '邮件原文内容' },
      inquiryDate: { type: 'string', description: '询价日期' },
      customerName: { type: 'string', description: '客户名称' },
      pol: { type: 'string', description: '起运港' },
      pod: { type: 'string', description: '目的港' },
      cargoName: { type: 'string', description: '货物品名' },
      containerType: { type: 'string', description: '箱型' },
      volume: { type: 'number', description: '体积(CBM)' },
      weight: { type: 'number', description: '重量(KG)' },
      etd: { type: 'string', description: '预计出货时间' },
      specialRequirements: { type: 'string', description: '特殊要求' },
    },
    handler: (params) => {
      const year = new Date().getFullYear();
      const userId = params.userId || process.env.DEFAULT_USER_ID || 'anonymous';
      
      const requiredFields = ['pol', 'pod', 'customerName', 'containerType'];
      const optionalFields = ['cargoName', 'volume', 'weight', 'etd', 'specialRequirements'];
      
      let filledCount = 0;
      requiredFields.forEach(f => { if (params[f]) filledCount += 2; });
      optionalFields.forEach(f => { if (params[f]) filledCount += 1; });
      const completeness = Math.round((filledCount / (requiredFields.length * 2 + optionalFields.length)) * 100);
      
      let status;
      if (completeness >= 100) status = 'inquiry';
      else if (completeness >= 60) status = 'pending';
      else status = 'draft';
      
      const id = `INQ-${year}-${String(mockData.inquiries.length + 1).padStart(3, '0')}`;
      const newInquiry = { 
        id, 
        messageId: params.messageId,
        userId,
        ...params,
        userId,
        completeness,
        status,
        createdBy: userId,
        createdAt: new Date().toISOString()
      };
      mockData.inquiries.push(newInquiry);
      saveData(mockData);
      return { 
        success: true, 
        inquiryId: id, 
        completeness,
        status,
        message: `询价记录已添加: ${id}`,
        inquiry: newInquiry
      };
    }
  },
  {
    name: 'add_quotation_record',
    description: '添加报价记录（自动计算总费用）',
    parameters: {
      userId: { type: 'string', description: '当前用户ID' },
      messageId: { type: 'string', description: '邮件唯一标识' },
      inquiryId: { type: 'string', description: '关联询价单号（必须）' },
      supplierId: { type: 'string', description: '供应商ID' },
      supplierName: { type: 'string', description: '供应商名称' },
      emailId: { type: 'string', description: '邮件ID' },
      emailContent: { type: 'string', description: '邮件原文' },
      quoteDate: { type: 'string', description: '报价日期' },
      pol: { type: 'string', description: '起运港' },
      pod: { type: 'string', description: '目的港' },
      ofRate: { type: 'number', description: '海运费' },
      localCharges: { type: 'number', description: '本地费' },
      otherCharges: { type: 'number', description: '其他费用' },
      containerType: { type: 'string', description: '箱型' },
      validDate: { type: 'string', description: '有效期' },
      transitTime: { type: 'string', description: '运输时间' },
      vesselName: { type: 'string', description: '船名' },
      remarks: { type: 'string', description: '备注' },
    },
    handler: (params) => {
      const inquiry = mockData.inquiries.find(i => i.id === params.inquiryId);
      if (!inquiry) {
        return { error: `未找到询价单: ${params.inquiryId}` };
      }
      
      const userId = params.userId || process.env.DEFAULT_USER_ID || 'anonymous';
      const ofRate = params.ofRate || 0;
      const localCharges = params.localCharges || 0;
      const otherCharges = params.otherCharges || 0;
      const totalCost = ofRate + localCharges + otherCharges;
      
      const year = new Date().getFullYear();
      const id = `QUO-${year}-${String(mockData.quotations.length + 1).padStart(3, '0')}`;
      const newQuotation = { 
        id, 
        messageId: params.messageId,
        userId,
        ...params,
        ofRate,
        localCharges,
        otherCharges,
        totalCost,
        createdBy: userId,
        createdAt: new Date().toISOString()
      };
      mockData.quotations.push(newQuotation);
      saveData(mockData);
      return { 
        success: true, 
        quotationId: id, 
        totalCost,
        message: `报价记录已添加: ${id}`,
        quotation: newQuotation
      };
    }
  },
  {
    name: 'get_quotations_by_inquiry',
    description: '获取询价的所有报价（1:N 查询）',
    parameters: {
      inquiryId: { type: 'string', description: '询价单号' },
    },
    handler: ({ inquiryId }) => {
      const inquiry = mockData.inquiries.find(i => i.id === inquiryId);
      if (!inquiry) {
        return { error: `未找到询价单: ${inquiryId}` };
      }
      const quotations = mockData.quotations.filter(q => q.inquiryId === inquiryId);
      return {
        inquiry,
        quotations,
        count: quotations.length
      };
    }
  },
  {
    name: 'search_supplier',
    description: '搜索供应商',
    parameters: {
      keyword: { type: 'string', description: '搜索关键词（公司名称/邮箱/电话）' },
      emailDomain: { type: 'string', description: '邮箱域名' },
    },
    handler: ({ keyword, emailDomain }) => {
      let results = mockData.suppliers;
      
      if (keyword) {
        const lowerKeyword = keyword.toLowerCase();
        results = results.filter(s => 
          s.name.toLowerCase().includes(lowerKeyword) ||
          s.email.toLowerCase().includes(lowerKeyword) ||
          s.contact.toLowerCase().includes(lowerKeyword) ||
          s.phone.includes(keyword)
        );
      }
      
      if (emailDomain) {
        results = results.filter(s => s.email.endsWith(`@${emailDomain}`));
      }
      
      return { suppliers: results, count: results.length };
    }
  },
  {
    name: 'search_inquiry',
    description: '搜索询价记录（仅返回当前用户的数据）',
    parameters: {
      userId: { type: 'string', description: '当前用户ID' },
      keyword: { type: 'string', description: '搜索关键词（客户名/询价单号/货物品名/路线）' },
      pol: { type: 'string', description: '起运港（可选）' },
      pod: { type: 'string', description: '目的港（可选）' },
      status: { type: 'string', description: '状态筛选（可选）' },
    },
    handler: ({ userId, keyword, pol, pod, status }) => {
      const uid = userId || process.env.DEFAULT_USER_ID || 'anonymous';
      let results = mockData.inquiries.filter(i => i.userId === uid);
      
      if (keyword) {
        const lowerKeyword = keyword.toLowerCase();
        results = results.filter(i => 
          (i.id && i.id.toLowerCase().includes(lowerKeyword)) ||
          (i.customerName && i.customerName.toLowerCase().includes(lowerKeyword)) ||
          (i.cargoName && i.cargoName.toLowerCase().includes(lowerKeyword)) ||
          (i.pol && i.pol.toLowerCase().includes(lowerKeyword)) ||
          (i.pod && i.pod.toLowerCase().includes(lowerKeyword))
        );
      }
      
      if (pol) {
        results = results.filter(i => i.pol && i.pol.includes(pol));
      }
      
      if (pod) {
        results = results.filter(i => i.pod && i.pod.includes(pod));
      }
      
      if (status) {
        results = results.filter(i => i.status === status);
      }
      
      return { inquiries: results, count: results.length };
    }
  },
  {
    name: 'get_my_inquiries',
    description: '获取当前用户的询价记录',
    parameters: {
      userId: { type: 'string', description: '当前用户ID' },
      status: { type: 'string', description: '状态筛选（可选）' },
      startDate: { type: 'string', description: '开始日期（可选）' },
      endDate: { type: 'string', description: '结束日期（可选）' },
    },
    handler: ({ userId, status, startDate, endDate }) => {
      const uid = userId || process.env.DEFAULT_USER_ID || 'anonymous';
      let results = mockData.inquiries.filter(i => i.userId === uid);
      
      if (status) {
        results = results.filter(i => i.status === status);
      }
      
      if (startDate) {
        results = results.filter(i => i.createdAt >= startDate);
      }
      
      if (endDate) {
        results = results.filter(i => i.createdAt <= endDate);
      }
      
      results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return { inquiries: results, count: results.length };
    }
  },
  {
    name: 'get_my_quotations',
    description: '获取当前用户的报价记录',
    parameters: {
      userId: { type: 'string', description: '当前用户ID' },
      inquiryId: { type: 'string', description: '关联询价单号（可选）' },
      supplierId: { type: 'string', description: '供应商ID（可选）' },
    },
    handler: ({ userId, inquiryId, supplierId }) => {
      const uid = userId || process.env.DEFAULT_USER_ID || 'anonymous';
      let results = mockData.quotations.filter(q => q.userId === uid);
      
      if (inquiryId) {
        results = results.filter(q => q.inquiryId === inquiryId);
      }
      
      if (supplierId) {
        results = results.filter(q => q.supplierId === supplierId);
      }
      
      results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return { quotations: results, count: results.length };
    }
  },
  {
    name: 'check_inquiry_exists',
    description: '检查邮件是否已添加询价（基于 messageId）',
    parameters: {
      messageId: { type: 'string', description: '邮件唯一标识' },
      userId: { type: 'string', description: '当前用户ID' },
    },
    handler: ({ messageId, userId }) => {
      const uid = userId || process.env.DEFAULT_USER_ID || 'anonymous';
      const inquiry = mockData.inquiries.find(i => i.messageId === messageId && i.userId === uid);
      if (inquiry) {
        return { exists: true, inquiryId: inquiry.id, status: inquiry.status, inquiry };
      }
      return { exists: false };
    }
  },
  {
    name: 'add_supplier',
    description: '添加新供应商',
    parameters: {
      userId: { type: 'string', description: '当前用户ID' },
      name: { type: 'string', description: '供应商名称' },
      contact: { type: 'string', description: '联系人' },
      email: { type: 'string', description: '邮箱' },
      phone: { type: 'string', description: '电话' },
      address: { type: 'string', description: '地址' },
      products: { type: 'array', description: '服务产品' },
      remarks: { type: 'string', description: '备注' },
    },
    handler: (params) => {
      const id = `S${String(mockData.suppliers.length + 1).padStart(3, '0')}`;
      const newSupplier = { id, ...params, rating: 0, createdBy: params.userId };
      mockData.suppliers.push(newSupplier);
      saveData(mockData);
      return { success: true, supplierId: id, supplier: newSupplier };
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
    case 'suppliers':
      res.json(mockData.suppliers);
      break;
    case 'inquiries':
      res.json(mockData.inquiries);
      break;
    case 'quotations':
      res.json(mockData.quotations);
      break;
    default:
      res.status(404).json({ error: `未知资源类型: ${type}` });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mock-mcp-server', version: '1.0.0' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mock MCP HTTP Server running on http://0.0.0.0:${PORT}`);
  console.log(`📋 工具列表: http://localhost:${PORT}/mcp/tools`);
  console.log(`📦 货运订单: http://localhost:${PORT}/mcp/resources/shipments`);
  console.log(`💾 数据文件: ${DATA_FILE}`);
});

# AI 邮件助手 - 业务需求文档

## 项目背景
为货运代理业务人员开发 AI 邮件助手，帮助快速分析邮件中的报价、询价信息，提升工作效率。

## 核心功能

### 1. 邮件智能分析
- 自动识别邮件中的询价信息（起运港、目的港、货物品名、体积/重量、箱型等）
- 自动识别邮件中的报价信息（海运费、本地费、有效期等）
- AI 分析后主动提示业务人员是否需要添加询价记录和报价记录，以及是否需要绑定供应商。

### 2. 询价记录管理
**触发条件：** AI 检测到邮件包含询价信息

**交互流程：**
1. AI 询问："检测到询价信息，是否需要添加到询价记录？"
2. 业务人员确认后，AI 提取关键字段
3. 通过 MCP API 将询价信息添加到后台系统

**需要字段：**
- 客户信息（从邮件发件人自动获取）
- 起运港 (POL)
- 目的港 (POD)
- 货物品名
- 箱型/体积
- 预计出货时间
- 邮件原文链接

### 3. 报价记录管理

**业务关系：**
- 询价 : 报价 = 1 : N（一个询价可以收到多个供应商的报价）
- 报价 : 供应商 = 1 : 1（一个报价对应一个供应商）

**触发条件：** 
- AI 检测到邮件包含报价信息
- 业务人员主动要求记录报价
- 从询价记录发起向供应商询价后收到回复

**交互流程：**
1. AI 识别报价邮件，提取报价信息
2. **自动匹配询价**：根据路线(POL/POD)、客户、箱型等匹配现有询价记录
   - 匹配成功：询问"是否为询价单 INQ-xxx 的报价？"
   - 匹配失败：询问"是否先创建询价记录？"
3. **绑定供应商**：询问报价来自哪家供应商
   - 自动识别：从邮件签名提取供应商信息
   - 手动选择：从供应商库选择
   - 快速添加：新增供应商
4. 通过 MCP API 将报价信息添加到后台，自动关联询价单

**需要字段：**
- **关联询价单号** (inquiryId) - 必填，报价必须绑定到某个询价
- 供应商信息 (supplierId, supplierName) - 必填
- 起运港-目的港 (pol, pod)
- 海运费 (ofRate)
- 本地费 (localCharges)
- 有效期 (validDate)
- 箱型 (containerType)
- 邮件ID (emailId)
- 报价日期 (quoteDate)

## 技术实现

### MCP API 接口设计

```javascript
// 添加询价记录
mcpTool: "add_inquiry_record"
parameters: {
  // 基本信息（从邮件自动提取）
  customerId: string,           // 客户ID（从邮件发件人匹配，可选）
  customerName: string,         // 客户名称（从邮件发件人提取）
  emailId: string,              // 邮件ID
  emailSubject: string,         // 邮件主题
  emailContent: string,         // 邮件原文（AI从中提取询价信息）
  inquiryDate: string,          // 询价日期（默认邮件日期）
  
  // 询价信息（AI从邮件内容提取，可选填）
  pol: string,                  // 起运港
  pod: string,                  // 目的港
  cargoName: string,            // 货物品名
  containerType: string,        // 箱型
  volume: number,               // 体积(CBM)
  weight: number,               // 重量(KG)
  etd: string,                  // 预计出货时间
  specialRequirements: string   // 特殊要求
}


// 添加报价记录
mcpTool: "add_quotation_record"
parameters: {
  // 关联信息（必须）
  inquiryId: string,            // 关联询价单号（必须）
  supplierId: string,           // 供应商ID
  supplierName: string,         // 供应商名称
  
  // 邮件信息
  emailId: string,              // 邮件ID
  emailContent: string,         // 邮件原文
  quoteDate: string,            // 报价日期
  
  // 报价信息（AI从邮件提取，可选填）
  pol: string,                  // 起运港
  pod: string,                  // 目的港
  ofRate: number,               // 海运费
  localCharges: number,         // 本地费
  containerType: string,        // 箱型
  validDate: string,            // 有效期
  transitTime: string,          // 运输时间
  vesselName: string,           // 船名
  remarks: string               // 备注
}


// 搜索供应商
mcpTool: "search_supplier"
parameters: {
  keyword: string,         // 搜索关键词（公司名称/邮箱/电话）
  emailDomain: string      // 邮箱域名
}

// 获取询价的所有报价（1:N 查询）
mcpTool: "get_quotations_by_inquiry"
parameters: {
  inquiryId: string        // 询价单号
}
returns: {
  inquiry: object,         // 询价信息
  quotations: array        // 该询价下的所有报价列表
}

// 获取供应商的所有报价（用于分析供应商历史价格）
mcpTool: "get_quotations_by_supplier"
parameters: {
  supplierId: string,      // 供应商ID
  pol: string,             // 起运港（可选）
  pod: string              // 目的港（可选）
}
```

### 供应商绑定方案

**方案一：自动识别**
- 从邮件签名中提取公司名、联系方式
- 与系统供应商库匹配
- 匹配度 > 80% 自动绑定，否则提示人工确认

**方案二：手动选择**
- AI 展示最近联系的供应商列表
- 业务人员点击选择
- 支持搜索供应商

**方案三：快速添加**
- 如供应商不在系统中，AI 询问是否添加新供应商
- 提取邮件中的供应商信息自动填充
- 业务人员确认后添加到供应商库

## 用户交互示例

### 场景一：收到询价邮件
```
AI: 检测到询价信息：
    - 客户: ABC Trading
    - 路线: Shanghai → Los Angeles
    - 货物品名: Electronics
    - 箱型: 1x40HQ
    
    是否需要添加到询价记录？
    [是] [否] [稍后提醒]

用户: 是

AI: 已添加询价记录，单号：INQ-2024-001
    是否需要向供应商发起询价？
    [选择供应商] [暂不发起]
```

### 场景二：收到报价邮件
```
AI: 检测到报价信息：
    - 供应商: MSC Shipping
    - 路线: Shanghai → Los Angeles
    - 箱型: 1x40HQ
    - 海运费: $3200
    - 有效期: 2024-06-30
    
    匹配到询价单：INQ-2024-001 (ABC Trading)
    是否为该询价的报价？
    [是] [不是，重新选择询价] [先创建新询价]

用户: 是

AI: 请确认供应商：
    1. MSC Shipping (匹配度 95%)
    2. MSC Agency
    3. 添加新供应商
    
用户: 选择 1

AI: 已添加报价记录：
    - 报价单号：QUO-2024-003
    - 关联询价：INQ-2024-001
    - 供应商：MSC Shipping
    - 价格：$3200
    
    该询价目前已有 3 个报价：
    1. MSC - $3200 ⭐ 最低
    2. MSK - $3500
    3. CMA - $3350
```

### 场景三：查看询价的所有报价
```
用户: 查看询价 INQ-2024-001 的所有报价

AI: 询价单 INQ-2024-001 (ABC Trading) 的报价情况：
    
    路线：Shanghai → Los Angeles, 1x40HQ
    
    已收到 3 个供应商报价：
    ┌─────────────┬──────────┬─────────────┬────────────┐
    │ 供应商      │ 海运费   │ 本地费      │ 有效期     │
    ├─────────────┼──────────┼─────────────┼────────────┤
    │ MSC         │ $3200 ⭐ │ $450        │ 2024-06-30 │
    │ CMA         │ $3350    │ $420        │ 2024-06-25 │
    │ MSK         │ $3500    │ $480        │ 2024-07-05 │
    └─────────────┴──────────┴─────────────┴────────────┘
    
    推荐：MSC 价格最低，建议优先考虑
```

## 后续优化

1. **智能匹配**：自动关联询价和报价记录
2. **价格比较**：同一航线多供应商报价对比
3. **到期提醒**：报价有效期到期前自动提醒
4. **客户画像**：分析客户询价偏好、活跃航线
5. **供应商评级**：基于报价响应速度、价格竞争力评分

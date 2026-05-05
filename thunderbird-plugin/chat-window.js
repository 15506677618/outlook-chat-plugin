// 配置加载 - 插件环境从 background.js 接收，本地环境使用默认值
let API_URL = 'https://koudai.xin/api/chat';  // 默认生产环境
let MCP_API_URL = 'https://koudai.xin/api/mcp';
let ACCESS_PASSWORD = 'koudai123'; // 默认密码

// DOM 元素
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// 状态
let conversationHistory = [];
let currentEmail = null;
let currentUserId = 'demo_user';
let currentUserName = '演示用户';

// 监听来自 background.js 的配置消息（插件环境）
if (typeof browser !== 'undefined' && browser.runtime) {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('收到插件消息:', message);
    
    if (message.type === 'config') {
      if (message.apiUrl) {
        // 清理 URL 中的反引号和空格
        let cleanUrl = message.apiUrl.replace(/[`\s]/g, '');
        API_URL = cleanUrl;
        // 同时更新 MCP_API_URL（去掉 /api/chat，加上 /api/mcp）
        const baseUrl = cleanUrl.replace('/api/chat', '');
        MCP_API_URL = baseUrl + '/api/mcp';
        console.log('[Config] API_URL 已更新:', API_URL);
        console.log('[Config] MCP_API_URL 已更新:', MCP_API_URL);
      }
      if (message.accessPassword) {
        ACCESS_PASSWORD = message.accessPassword;
        console.log('[Config] ACCESS_PASSWORD 已更新');
      }
      sendResponse({ success: true });
    }
    
    if (message.type === 'emailContent') {
      handleEmailContent(message);
      sendResponse({ success: true });
    }
    
    return true;
  });
  
  // 向 background.js 请求配置
  browser.runtime.sendMessage({ type: 'getConfig' });
}

// 获取用户信息
let enableMockEmail = false;

async function loadUserInfo() {
  try {
    const res = await fetch('/api/user/info');
    if (res.ok) {
      const data = await res.json();
      currentUserId = data.userId;
      currentUserName = data.userName;
      enableMockEmail = data.enableMockEmail || false;
      
      // 根据配置显示/隐藏模拟邮件按钮
      const loadEmailBtn = document.getElementById('load-email-btn');
      if (loadEmailBtn) {
        loadEmailBtn.style.display = enableMockEmail ? 'inline-block' : 'none';
      }
    }
  } catch (e) {
    console.log('使用默认用户信息');
  }
}
loadUserInfo();

// 监听来自父窗口的邮件数据（作为备用方式）
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'emailContent') {
    // 避免重复处理，如果 browser.runtime 已经处理了则跳过
    if (currentEmail && currentEmail.messageId === event.data.messageId) {
      return;
    }
    handleEmailContent(event.data);
  }
});

// 统一处理邮件内容的函数
function handleEmailContent(emailData) {
  currentEmail = emailData;
  
  // 确保 messageId 存在（从 conversation 或生成一个）
  if (!currentEmail.messageId) {
    if (currentEmail.conversation && currentEmail.conversation.length > 0 && currentEmail.conversation[0].id) {
      currentEmail.messageId = currentEmail.conversation[0].id;
    } else if (currentEmail.id) {
      currentEmail.messageId = currentEmail.id;
    } else {
      // 生成一个基于主题的临时 ID
      currentEmail.messageId = 'msg-' + (currentEmail.subject || 'unknown') + '-' + Date.now();
    }
    console.log('[handleEmailContent] 生成 messageId:', currentEmail.messageId);
  }
  
  // 更新邮件显示区域
  const emailFromEl = document.getElementById('email-from');
  const emailSubjectEl = document.getElementById('email-subject');
  const emailDateEl = document.getElementById('email-date');
  const emailMessageIdEl = document.getElementById('email-message-id');
  const emailBodyEl = document.getElementById('email-body');
  
  console.log('[邮件加载] DOM元素检查:', {
    emailFromEl: !!emailFromEl,
    emailSubjectEl: !!emailSubjectEl,
    emailDateEl: !!emailDateEl,
    emailMessageIdEl: !!emailMessageIdEl,
    emailBodyEl: !!emailBodyEl
  });
  
  if (emailFromEl) emailFromEl.textContent = currentEmail.from || '-';
  if (emailSubjectEl) emailSubjectEl.textContent = currentEmail.subject || '-';
  if (emailDateEl) emailDateEl.textContent = currentEmail.date || '-';
  if (emailMessageIdEl) {
    // 使用 setTimeout 确保 DOM 更新
    setTimeout(() => {
      emailMessageIdEl.textContent = String(currentEmail.messageId || '-');
      emailMessageIdEl.style.display = 'inline';
      emailMessageIdEl.style.visibility = 'visible';
      console.log('[邮件加载] 已设置messageId到DOM:', currentEmail.messageId);
    }, 0);
  } else {
    console.error('[邮件加载] 找不到email-message-id元素');
  }
  
  // 打印 messageId 到控制台
  console.log('[邮件加载] messageId:', currentEmail.messageId);
  console.log('[邮件加载] 主题:', currentEmail.subject);
  console.log('[邮件加载] 发件人:', currentEmail.from);
  
  // 构建邮件内容
  let emailBody = '';
  if (currentEmail.conversation && currentEmail.conversation.length > 0) {
    currentEmail.conversation.forEach((msg) => {
      const prefix = msg.isReply ? '【回复】' : '【原始】';
      emailBody += `${prefix} ${msg.from} (${msg.date}):\n${msg.body}\n\n${'='.repeat(50)}\n\n`;
    });
    // 同时设置 currentEmail.body 为第一个邮件的内容（用于询价提取）
    if (!currentEmail.body) {
      currentEmail.body = currentEmail.conversation[0].body || '';
    }
  } else {
    emailBody = currentEmail.body || '（无法获取邮件内容）';
  }
  if (emailBodyEl) {
    emailBodyEl.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${emailBody}</pre>`;
  }
  
  // 添加欢迎消息
  let welcomeMsg = `📧 **已加载邮件**\n\n**主题：** ${currentEmail.subject}\n**发件人：** ${currentEmail.from}\n**日期：** ${currentEmail.date}`;
  if (currentEmail.conversation && currentEmail.conversation.length > 1) {
    welcomeMsg += `\n\n📨 **此邮件会话共 ${currentEmail.conversation.length} 封邮件**`;
  }
  welcomeMsg += `\n\n您可以询问我关于这封邮件的任何问题！`;
  addMessage(welcomeMsg, false);
}

function addMessage(content, isUser = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = isUser ? '👤' : '🤖';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';
  contentDiv.innerHTML = content;

  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);
  messagesContainer.appendChild(messageDiv);

  // 滚动到底部
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message bot typing';
  typingDiv.id = 'typing-indicator';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = '🤖';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';
  contentDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

  typingDiv.appendChild(avatar);
  typingDiv.appendChild(contentDiv);
  messagesContainer.appendChild(typingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator() {
  const typingIndicator = document.getElementById('typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

function getEmailContext() {
  if (!currentEmail) return '';
  return `当前邮件信息：
发件人：${currentEmail.from}
主题：${currentEmail.subject}
日期：${currentEmail.date}
内容：
${currentEmail.body}
`;
}

async function sendMessage() {
  const message = userInput.value.trim();

  if (!message) return;

  addMessage(message, true);
  
  // 检测用户是否查询报价
  const quotationQueryMatch = message.match(/查看\s*([A-Z0-9-]+)\s*的?报价|查询\s*([A-Z0-9-]+)\s*的?报价/i);
  if (quotationQueryMatch) {
    const inquiryId = quotationQueryMatch[1] || quotationQueryMatch[2];
    userInput.value = '';
    userInput.style.height = 'auto';
    
    // 在右侧侧边栏显示报价
    await loadQuotationsForInquiry(inquiryId);
    addMessage(`已在右侧侧边栏显示询价单 ${inquiryId} 的报价记录`, false);
    return;
  }
  
  // 构建包含邮件上下文的对话
  const emailContext = currentEmail ? getEmailContext() : '';
  const userMessageWithContext = emailContext 
    ? `${emailContext}\n\n用户问题：${message}`
    : message;
  
  conversationHistory.push({ role: 'user', content: userMessageWithContext });

  userInput.value = '';
  userInput.style.height = 'auto';

  addTypingIndicator();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_PASSWORD}`
      },
      body: JSON.stringify({
        messages: conversationHistory,
        userMessage: message,
        emailContext: currentEmail || null,
        stream: false  // 明确指定非流式响应
      })
    });

    removeTypingIndicator();

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // 检查是否是流式响应
    const contentType = response.headers.get('content-type');
    let botMessage = '';
    
    if (contentType && contentType.includes('text/event-stream')) {
      // 处理流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                fullContent += parsed.choices[0].delta.content;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
      
      botMessage = fullContent || '抱歉，我没有收到回复。';
    } else {
      // 处理非流式 JSON 响应
      const data = await response.json();
      botMessage = data.response || data.message || '抱歉，我没有收到回复。';
    }

    // 将 AI 回复添加到对话历史（不包含完整邮件上下文）
    conversationHistory.push({ role: 'assistant', content: botMessage });

    addMessage(botMessage);

  } catch (error) {
    removeTypingIndicator();

    const errorMessage = `❌ 发送失败：${error.message}。请检查网络连接或后端服务是否运行。`;
    addMessage(errorMessage);

    console.error('Chat error:', error);
  }
}

function handleKeyPress(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize() {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 150) + 'px';
}

// 事件监听
userInput.addEventListener('keydown', handleKeyPress);
userInput.addEventListener('input', autoResize);
sendBtn.addEventListener('click', sendMessage);

// 模拟邮件数据（本地调试用）
const mockEmails = [
  {
    id: 'msg-inquiry-001',
    subject: '询价：上海到洛杉矶海运',
    from: '张三 <zhangsan@example.com>',
    date: '2024-01-15',
    body: `您好，

请报以下货物的海运价格：

起运港：上海
目的港：洛杉矶
货物品名：电子产品
箱型：40HQ
体积：65CBM
重量：18000KG
预计出货时间：2024-02-01
特殊要求：需要温控

谢谢！

张三`
  },
  {
    id: 'msg-quotation-001', 
    subject: '报价回复：上海到洛杉矶海运',
    from: '李四 <lisi@shipping.com>',
    date: '2024-01-15',
    body: `您好，

根据您的需求，报价如下：

运费：USD 3200/40HQ
有效期：2024-02-15
船期：每周五
航程：14天

包含：海运费、THC、文件费
不包含：目的港费用、关税

如有疑问请随时联系。

李四`
  }
];

// 加载邮件按钮（仅在启用模拟邮件时绑定事件）
const loadEmailBtn = document.getElementById('load-email-btn');
if (loadEmailBtn) {
  // 初始隐藏按钮，等待配置加载
  loadEmailBtn.style.display = 'none';
  
  loadEmailBtn.addEventListener('click', () => {
    // 检查是否启用了模拟邮件
    if (!enableMockEmail) {
      addMessage('⚠️ 模拟邮件功能仅在开发环境可用', false);
      return;
    }
    
    // 随机选择一个模拟邮件
    const randomEmail = mockEmails[Math.floor(Math.random() * mockEmails.length)];
    currentEmail = randomEmail;
    
    // 更新邮件显示
    document.getElementById('email-from').textContent = randomEmail.from;
    document.getElementById('email-subject').textContent = randomEmail.subject;
    document.getElementById('email-date').textContent = randomEmail.date;
    document.getElementById('email-body').innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${randomEmail.body}</pre>`;
    
    // 添加提示消息
    addMessage(`📧 **已加载邮件**

**主题：** ${randomEmail.subject}
**发件人：** ${randomEmail.from}

您可以：
- 询问关于这封邮件的问题
- 点击"添加询价"将邮件转为询价记录
- 点击"添加报价"添加报价记录`, false);
  });
}

// ========== 添加报价表单逻辑 ==========
let selectedInquiry = null;
let selectedSupplier = null;
let currentDropdownType = ''; // 'inquiry' 或 'supplier'
let dropdownDebounceTimer = null;

// 分页状态
let inquiryPagination = { page: 1, pageSize: 10, total: 0, keyword: '' };
let supplierPagination = { page: 1, pageSize: 10, total: 0, keyword: '' };

// 安全获取 DOM 元素
function getElement(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(`Element #${id} not found`);
  return el;
}

const formModal = getElement('form-modal');
const formClose = getElement('form-close');
const formCancel = getElement('form-cancel');
const formConfirm = getElement('form-confirm');
const btnAddQuotation = getElement('btn-add-quotation');
const btnSearchInquiry = getElement('btn-search-inquiry');
const btnSearchSupplier = getElement('btn-search-supplier');
const btnChangeInquiry = getElement('btn-change-inquiry');
const btnChangeSupplier = getElement('btn-change-supplier');
const dropdownInquiry = getElement('dropdown-inquiry');
const dropdownSupplier = getElement('dropdown-supplier');

// 打开添加报价表单（如果按钮存在）
if (btnAddQuotation) {
  btnAddQuotation.addEventListener('click', () => {
    console.log('添加报价按钮被点击');
    // 使用右侧侧边栏而不是弹窗
    showAddQuotationSidebar();
  });
}

// 关闭表单
if (formClose) {
  formClose.addEventListener('click', () => {
    if (formModal) formModal.style.display = 'none';
  });
}
if (formCancel) {
  formCancel.addEventListener('click', () => {
    if (formModal) formModal.style.display = 'none';
  });
}

// 点击遮罩关闭
if (formModal) {
  formModal.addEventListener('click', (e) => {
    if (e.target === formModal) {
      formModal.style.display = 'none';
    }
  });
}

// 搜索按钮点击
if (btnSearchInquiry) {
  btnSearchInquiry.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('搜索询价按钮被点击');
    const keyword = getElement('form-inquiry-id')?.value || '';
    inquiryPagination.keyword = keyword;
    inquiryPagination.page = 1;
    performDropdownSearch('inquiry', keyword, inquiryPagination.page, inquiryPagination.pageSize);
  });
} else {
  console.error('btnSearchInquiry 元素未找到');
}

if (btnSearchSupplier) {
  btnSearchSupplier.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('搜索供应商按钮被点击');
    const keyword = getElement('form-supplier-id')?.value || '';
    supplierPagination.keyword = keyword;
    supplierPagination.page = 1;
    performDropdownSearch('supplier', keyword, supplierPagination.page, supplierPagination.pageSize);
  });
} else {
  console.error('btnSearchSupplier 元素未找到');
}

// 更换按钮
if (btnChangeInquiry) {
  btnChangeInquiry.addEventListener('click', () => {
    selectedInquiry = null;
    const selectedInquiryEl = getElement('selected-inquiry');
    const formInquiryId = getElement('form-inquiry-id');
    if (selectedInquiryEl) selectedInquiryEl.style.display = 'none';
    if (formInquiryId) formInquiryId.value = '';
    updateConfirmButton();
  });
}

if (btnChangeSupplier) {
  btnChangeSupplier.addEventListener('click', () => {
    selectedSupplier = null;
    const selectedSupplierEl = getElement('selected-supplier');
    const formSupplierId = getElement('form-supplier-id');
    if (selectedSupplierEl) selectedSupplierEl.style.display = 'none';
    if (formSupplierId) formSupplierId.value = '';
    updateConfirmButton();
  });
}

// 输入框输入事件（防抖搜索）
getElement('form-inquiry-id')?.addEventListener('input', (e) => {
  clearTimeout(dropdownDebounceTimer);
  dropdownDebounceTimer = setTimeout(() => {
    inquiryPagination.keyword = e.target.value;
    inquiryPagination.page = 1;
    performDropdownSearch('inquiry', e.target.value, inquiryPagination.page, inquiryPagination.pageSize);
  }, 300);
});

getElement('form-supplier-id')?.addEventListener('input', (e) => {
  clearTimeout(dropdownDebounceTimer);
  dropdownDebounceTimer = setTimeout(() => {
    supplierPagination.keyword = e.target.value;
    supplierPagination.page = 1;
    performDropdownSearch('supplier', e.target.value, supplierPagination.page, supplierPagination.pageSize);
  }, 300);
});

// 点击外部关闭下拉
document.addEventListener('click', (e) => {
  if (dropdownInquiry && !e.target.closest('#form-inquiry-id') && !e.target.closest('#dropdown-inquiry')) {
    dropdownInquiry.style.display = 'none';
  }
  if (dropdownSupplier && !e.target.closest('#form-supplier-id') && !e.target.closest('#dropdown-supplier')) {
    dropdownSupplier.style.display = 'none';
  }
});

// 执行下拉搜索（支持分页）
async function performDropdownSearch(type, keyword, page = 1, pageSize = 10) {
  console.log(`执行搜索: type=${type}, keyword=${keyword}, page=${page}`);
  currentDropdownType = type;
  const dropdown = type === 'inquiry' ? dropdownInquiry : dropdownSupplier;
  const pagination = type === 'inquiry' ? inquiryPagination : supplierPagination;
  
  if (!dropdown) return;
  
  dropdown.innerHTML = '<div class="dropdown-loading">搜索中...</div>';
  dropdown.style.display = 'block';
  console.log('下拉列表已显示');
  
  try {
    let results = [];
    let total = 0;
    
    if (type === 'inquiry') {
      // 调用 MCP API 搜索询价单（带分页）
      const res = await fetch(`${MCP_API_URL}/search_inquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_PASSWORD}`
        },
        body: JSON.stringify({
          userId: currentUserId,
          keyword: keyword,
          page: page,
          pageSize: pageSize
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        results = data.inquiries || [];
        total = data.total || results.length;
        inquiryPagination.total = total;
        inquiryPagination.page = page;
      }
    } else {
      // 调用 MCP API 搜索供应商（带分页）
      const res = await fetch(`${MCP_API_URL}/search_supplier`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_PASSWORD}`
        },
        body: JSON.stringify({
          keyword: keyword,
          userId: currentUserId,
          page: page,
          pageSize: pageSize
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        results = data.suppliers || [];
        total = data.total || results.length;
        supplierPagination.total = total;
        supplierPagination.page = page;
      }
    }
    
    // 渲染下拉结果
    if (results.length === 0) {
      dropdown.innerHTML = '<div class="dropdown-empty">未找到结果</div>';
    } else {
      const totalPages = Math.ceil(total / pageSize);
      const startIdx = (page - 1) * pageSize + 1;
      const endIdx = startIdx + results.length - 1;
      
      let html = results.map(item => {
        if (type === 'inquiry') {
          return `
            <div class="dropdown-item" data-id="${item.id}" data-type="inquiry">
              <div class="dropdown-item-title">${item.id}</div>
              <div class="dropdown-item-desc">${item.pol || '-'} → ${item.pod || '-'} | ${item.cargoName || '-'} | ${item.containerType || '-'}</div>
            </div>
          `;
        } else {
          return `
            <div class="dropdown-item" data-id="${item.id}" data-type="supplier">
              <div class="dropdown-item-title">${item.name}</div>
              <div class="dropdown-item-desc">${item.contact || '-'} | ${item.email || '-'}</div>
            </div>
          `;
        }
      }).join('');
      
      // 添加分页控件
      if (totalPages > 1) {
        html += `
          <div class="dropdown-pagination">
            <button class="page-btn prev" ${page <= 1 ? 'disabled' : ''} data-type="${type}" data-page="${page - 1}">上一页</button>
            <span class="page-info">${page} / ${totalPages}页 (${startIdx}-${endIdx}/${total})</span>
            <button class="page-btn next" ${page >= totalPages ? 'disabled' : ''} data-type="${type}" data-page="${page + 1}">下一页</button>
          </div>
        `;
      } else {
        html += `<div class="dropdown-pagination"><span class="page-info">共 ${total} 条记录</span></div>`;
      }
      
      dropdown.innerHTML = html;
      
      // 绑定列表项点击事件
      dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.id;
          const itemType = item.dataset.type;
          
          if (itemType === 'inquiry') {
            selectedInquiry = results.find(r => r.id === id);
            const formInquiryId = getElement('form-inquiry-id');
            const selectedInquiryId = getElement('selected-inquiry-id');
            const selectedInquiryEl = getElement('selected-inquiry');
            if (formInquiryId) formInquiryId.value = selectedInquiry.id;
            if (selectedInquiryId) selectedInquiryId.textContent = selectedInquiry.id;
            if (selectedInquiryEl) selectedInquiryEl.style.display = 'block';
          } else {
            selectedSupplier = results.find(r => r.id === id);
            const formSupplierId = getElement('form-supplier-id');
            const selectedSupplierId = getElement('selected-supplier-id');
            const selectedSupplierEl = getElement('selected-supplier');
            if (formSupplierId) formSupplierId.value = selectedSupplier.name;
            if (selectedSupplierId) selectedSupplierId.textContent = selectedSupplier.name;
            if (selectedSupplierEl) selectedSupplierEl.style.display = 'block';
          }
          
          dropdown.style.display = 'none';
          updateConfirmButton();
        });
      });
      
      // 绑定分页按钮点击事件
      dropdown.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const btnType = btn.dataset.type;
          const btnPage = parseInt(btn.dataset.page);
          if (btnType === 'inquiry') {
            inquiryPagination.page = btnPage;
            performDropdownSearch('inquiry', inquiryPagination.keyword, btnPage, inquiryPagination.pageSize);
          } else {
            supplierPagination.page = btnPage;
            performDropdownSearch('supplier', supplierPagination.keyword, btnPage, supplierPagination.pageSize);
          }
        });
      });
    }
  } catch (error) {
    console.error('搜索失败:', error);
    dropdown.innerHTML = '<div class="dropdown-error">搜索失败，请重试</div>';
  }
}

// 更新确认按钮状态
function updateConfirmButton() {
  if (formConfirm) {
    formConfirm.disabled = !(selectedInquiry && selectedSupplier);
  }
}

// 确认添加报价
if (formConfirm) {
  formConfirm.addEventListener('click', async () => {
    if (!selectedInquiry || !selectedSupplier) return;
    
    const quotationData = {
      userId: currentUserId,
      userName: currentUserName,
      messageId: currentEmail?.messageId || 'mock-msg-' + Date.now(),
      inquiryId: selectedInquiry.id,
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      emailId: currentEmail?.id || '',
      emailContent: currentEmail?.body || '',
      quoteDate: new Date().toISOString().split('T')[0],
      extractedData: {}  // 简化：只保留必要字段
    };
    
    try {
      formConfirm.disabled = true;
      formConfirm.textContent = '添加中...';
      
      const res = await fetch(`${MCP_API_URL}/add_quotation_record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_PASSWORD}`
        },
        body: JSON.stringify(quotationData)
      });
      
      if (res.ok) {
        const data = await res.json();
        const quotationId = data.quotationId || '未知';
        console.log('报价添加成功，准备显示在右侧侧边栏:', quotationId);
        
        // 在右侧侧边栏显示报价信息
        await showQuotationInPanel({
          quotationId,
          inquiryId: selectedInquiry.id,
          supplierName: selectedSupplier.name,
          isNew: true
        });
        
        // 同时在聊天中显示简洁提示
        addMessage(`✅ 报价已添加：${quotationId}，请在右侧查看详情`, false);
        
        formModal.style.display = 'none';
      } else {
        throw new Error('添加失败');
      }
    } catch (error) {
      console.error('添加报价失败:', error);
      addMessage(`❌ 添加报价失败：${error.message}`, false);
    } finally {
      formConfirm.disabled = false;
      formConfirm.textContent = '确认添加';
    }
  });
}

// ========== 添加询价逻辑 ==========
const btnAddInquiry = document.getElementById('btn-add-inquiry');
if (btnAddInquiry) {
  btnAddInquiry.addEventListener('click', async () => {
    if (!currentEmail) {
      addMessage('⚠️ 请先加载邮件', false);
      return;
    }
    
    if (!currentEmail.body) {
      addMessage('⚠️ 邮件内容为空，无法提取信息', false);
      return;
    }
    
    // 检查邮件是否与询价相关
    const isInquiryRelated = checkIfInquiryRelated(currentEmail.body);
    if (!isInquiryRelated) {
      addMessage(`⚠️ 此邮件内容与货运询价无关

邮件主题：${currentEmail.subject}

只有包含货运、物流、询价、报价等相关内容的邮件才能添加为询价记录。`, false);
      return;
    }
    
    // 检查是否已添加
    try {
      console.log('[添加询价] 检查是否存在 - messageId:', currentEmail.messageId, 'userId:', currentUserId);
      
      const checkRes = await fetch(`${MCP_API_URL}/check_inquiry_exists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_PASSWORD}`
        },
        body: JSON.stringify({
          messageId: currentEmail.messageId,
          userId: currentUserId
        })
      });
      
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        console.log('[添加询价] 检查结果:', checkData);
        
        // 处理嵌套的 result 结构
        const result = checkData.result || checkData;
        if (result.exists) {
          addMessage(`⚠️ 该邮件已添加过询价记录

单号：${result.inquiryId}
状态：${result.status}

[查看详情] [添加报价] [继续聊天]`, false);
          return;
        }
      }
    } catch (e) {
      console.log('[添加询价] 检查失败，继续添加:', e);
    }
    
    // 提取邮件信息
    const inquiryData = {
      userId: currentUserId,
      userName: currentUserName,
      messageId: currentEmail.messageId,
      customerName: currentEmail.from.split('<')[0].trim(),
      emailId: currentEmail.id,
      emailSubject: currentEmail.subject,
      emailContent: currentEmail.body,
      inquiryDate: currentEmail.date,
      extractedData: {
        pol: extractField(currentEmail.body, '起运港'),
        pod: extractField(currentEmail.body, '目的港'),
        cargoName: extractField(currentEmail.body, '货物品名'),
        containerType: extractField(currentEmail.body, '箱型'),
        volume: parseFloat(extractField(currentEmail.body, '体积')) || 0,
        weight: parseFloat(extractField(currentEmail.body, '重量')) || 0,
        etd: extractField(currentEmail.body, '预计出货时间'),
        specialRequirements: extractField(currentEmail.body, '特殊要求')
      }
    };
    
    // 计算完整度
    const requiredFields = ['pol', 'pod', 'cargoName', 'containerType'];
    const filledFields = requiredFields.filter(f => inquiryData.extractedData[f]).length;
    const completeness = Math.round((filledFields / requiredFields.length) * 100);
    
    // 添加询价
    try {
      const requestUrl = `${MCP_API_URL}/add_inquiry_record`;
      console.log('[添加询价] MCP_API_URL:', MCP_API_URL);
      console.log('[添加询价] 请求 URL:', requestUrl);
      console.log('[添加询价] 当前用户:', currentUserId);
      
      const res = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_PASSWORD}`
        },
        body: JSON.stringify({
          ...inquiryData,
          completeness,
          status: completeness >= 100 ? 'inquiry' : completeness >= 60 ? 'pending' : 'draft'
        })
      });
      
      console.log('[添加询价] 响应状态:', res.status, res.statusText);
      
      if (res.ok) {
        const data = await res.json();
        
        // 检查是否已存在
        if (data.exists) {
          addMessage(`⚠️ **该邮件已添加过询价记录**

单号：${data.inquiryId}
状态：${data.status || 'inquiry'}

[查看详情] [添加报价] [继续聊天]`, false);
          return;
        }
        
        const inquiryId = data.inquiryId || '未知';
        addMessage(`✅ **询价添加成功**

单号：${inquiryId}
完整度：${completeness}%
状态：${completeness >= 100 ? '✅ 信息完整' : completeness >= 60 ? '⚠️ 待补充' : '❌ 草稿'}

提取信息：
- 起运港：${inquiryData.extractedData.pol || '未提供'}
- 目的港：${inquiryData.extractedData.pod || '未提供'}
- 货物品名：${inquiryData.extractedData.cargoName || '未提供'}
- 箱型：${inquiryData.extractedData.containerType || '未提供'}

[添加报价] [查看详情] [继续聊天]`, false);
      } else {
        const errorText = await res.text();
        console.error('[添加询价] 错误响应:', errorText);
        throw new Error(`HTTP ${res.status}: ${errorText || '添加失败'}`);
      }
    } catch (error) {
      console.error('添加询价失败:', error);
      addMessage(`❌ 添加询价失败：${error.message}`, false);
    }
  });
}

// 检查邮件是否与询价相关
function checkIfInquiryRelated(body) {
  if (!body || typeof body !== 'string') {
    return false;
  }
  
  // 定义与货运询价相关的关键词
  const inquiryKeywords = [
    // 中文关键词
    '询价', '报价', '运费', '海运', '空运', '陆运', '物流', '货运',
    '集装箱', '整箱', '拼箱', 'FCL', 'LCL', '货代', '船运', '港口',
    '起运港', '目的港', 'POL', 'POD', '提单', 'B/L', '订舱',
    '柜型', '箱型', '20GP', '40GP', '40HQ', '45HQ', '柜量',
    '吨', 'kg', 'CBM', '方', '重量', '体积', '货重',
    '船期', '船名', '航次', 'ETD', 'ETA', '预计到港',
    '运费', '海运费', '附加费', 'THC', '文件费', '码头费',
    // 英文关键词
    'inquiry', 'quotation', 'quote', 'freight', 'shipping', 'cargo',
    'container', 'FCL', 'LCL', 'logistics', 'forwarder', 'vessel',
    'port of loading', 'port of discharge', 'POL', 'POD',
    'bill of lading', 'booking', 'shipment', 'consignment',
    '20ft', '40ft', '40HQ', 'TEU', 'container type',
    'weight', 'volume', 'CBM', 'tons', 'kg',
    'freight cost', 'ocean freight', 'local charges'
  ];
  
  const lowerBody = body.toLowerCase();
  
  // 检查是否包含至少 2 个相关关键词（避免误判）
  let matchCount = 0;
  for (const keyword of inquiryKeywords) {
    if (lowerBody.includes(keyword.toLowerCase())) {
      matchCount++;
      if (matchCount >= 2) {
        return true;
      }
    }
  }
  
  return false;
}

// 提取字段函数
function extractField(body, fieldName) {
  if (!body || typeof body !== 'string') {
    return '';
  }
  
  const patterns = {
    '起运港': /起运港[：:]\s*([^\n]+)/i,
    '目的港': /目的港[：:]\s*([^\n]+)/i,
    '货物品名': /货物品名[：:]\s*([^\n]+)/i,
    '箱型': /箱型[：:]\s*([^\n]+)/i,
    '体积': /体积[：:]\s*(\d+(?:\.\d+)?)\s*CBM/i,
    '重量': /重量[：:]\s*(\d+(?:\.\d+)?)\s*KG/i,
    '预计出货时间': /预计出货时间[：:]\s*([^\n]+)/i,
    '特殊要求': /特殊要求[：:]\s*([^\n]+)/i
  };
  
  const pattern = patterns[fieldName];
  if (pattern) {
    const match = body.match(pattern);
    return match ? match[1].trim() : '';
  }
  return '';
}

// ========== 报价侧边栏功能（右侧） ==========
const quotationSidebar = getElement('quotation-sidebar');
const inquiryInfoSection = getElement('inquiry-info-section');
const inquiryInfoContent = getElement('inquiry-info-content');
const quotationListContent = getElement('quotation-list-content');
const btnCloseQuotationSidebar = getElement('btn-close-quotation-sidebar');

// 添加报价侧边栏
const addQuotationSidebar = getElement('add-quotation-sidebar');
const btnCloseAddQuotation = getElement('btn-close-add-quotation');

console.log('报价侧边栏元素:', { 
  quotationSidebar: !!quotationSidebar, 
  inquiryInfoSection: !!inquiryInfoSection,
  inquiryInfoContent: !!inquiryInfoContent,
  quotationListContent: !!quotationListContent,
  btnCloseQuotationSidebar: !!btnCloseQuotationSidebar,
  addQuotationSidebar: !!addQuotationSidebar,
  btnCloseAddQuotation: !!btnCloseAddQuotation
});

// 关闭报价侧边栏
if (btnCloseQuotationSidebar) {
  btnCloseQuotationSidebar.addEventListener('click', () => {
    if (quotationSidebar) quotationSidebar.style.display = 'none';
  });
}

// 存储搜索状态
let myInquiriesSearchState = {
  keyword: '',
  filteredData: []
};

// 返回按钮 - 从报价侧边栏返回到我的询价列表
const btnBackToInquiries = getElement('btn-back-to-inquiries');
if (btnBackToInquiries) {
  btnBackToInquiries.addEventListener('click', () => {
    console.log('返回按钮点击');
    // 隐藏报价侧边栏
    if (quotationSidebar) quotationSidebar.style.display = 'none';
    // 显示我的询价侧边栏
    if (myInquiriesSidebar) {
      myInquiriesSidebar.style.display = 'flex';
      // 恢复搜索框的值
      const searchInput = document.getElementById('my-inquiries-search');
      if (searchInput && myInquiriesSearchState.keyword) {
        searchInput.value = myInquiriesSearchState.keyword;
      }
      // 恢复搜索后的列表，不重新加载
      if (myInquiriesSearchState.filteredData.length > 0) {
        renderInquiriesList(myInquiriesSearchState.filteredData);
      } else if (currentInquiriesData.length > 0) {
        renderInquiriesList(currentInquiriesData);
      }
    }
  });
}

// 关闭添加报价侧边栏
if (btnCloseAddQuotation) {
  btnCloseAddQuotation.addEventListener('click', () => {
    if (addQuotationSidebar) addQuotationSidebar.style.display = 'none';
  });
}

// 显示添加报价侧边栏
function showAddQuotationSidebar() {
  console.log('showAddQuotationSidebar 被调用');
  if (!addQuotationSidebar) {
    console.error('添加报价侧边栏未找到');
    // 回退到弹窗
    if (formModal) {
      selectedInquiry = null;
      selectedSupplier = null;
      inquiryPagination = { page: 1, pageSize: 10, total: 0, keyword: '' };
      supplierPagination = { page: 1, pageSize: 10, total: 0, keyword: '' };
      
      const formInquiryId = getElement('form-inquiry-id');
      const formSupplierId = getElement('form-supplier-id');
      const selectedInquiryEl = getElement('selected-inquiry');
      const selectedSupplierEl = getElement('selected-supplier');
      
      if (formInquiryId) formInquiryId.value = '';
      if (formSupplierId) formSupplierId.value = '';
      if (selectedInquiryEl) selectedInquiryEl.style.display = 'none';
      if (selectedSupplierEl) selectedSupplierEl.style.display = 'none';
      if (formConfirm) formConfirm.disabled = true;
      
      formModal.style.display = 'flex';
    }
    return;
  }
  
  // 隐藏其他侧边栏
  if (quotationSidebar) quotationSidebar.style.display = 'none';
  
  // 重置状态
  selectedInquiry = null;
  selectedSupplier = null;
  
  // 重置表单
  const sidebarInquiryId = getElement('sidebar-inquiry-id');
  const sidebarSupplierId = getElement('sidebar-supplier-id');
  const sidebarSelectedInquiry = getElement('sidebar-selected-inquiry');
  const sidebarSelectedSupplier = getElement('sidebar-selected-supplier');
  const sidebarConfirm = getElement('btn-sidebar-confirm');
  
  if (sidebarInquiryId) sidebarInquiryId.value = '';
  if (sidebarSupplierId) sidebarSupplierId.value = '';
  if (sidebarSelectedInquiry) sidebarSelectedInquiry.style.display = 'none';
  if (sidebarSelectedSupplier) sidebarSelectedSupplier.style.display = 'none';
  if (sidebarConfirm) sidebarConfirm.disabled = true;
  
  // 显示侧边栏
  addQuotationSidebar.style.display = 'flex';
  
  // 绑定侧边栏搜索按钮事件（只绑定一次）
  bindSidebarSearchEvents();
}

// 侧边栏搜索事件绑定
let sidebarEventsBound = false;
function bindSidebarSearchEvents() {
  console.log('bindSidebarSearchEvents 被调用');
  if (sidebarEventsBound) {
    console.log('事件已绑定，跳过');
    return;
  }
  sidebarEventsBound = true;
  
  // 询价搜索按钮
  const btnSidebarSearchInquiry = getElement('btn-sidebar-search-inquiry');
  console.log('询价搜索按钮:', btnSidebarSearchInquiry ? '找到' : '未找到');
  if (btnSidebarSearchInquiry) {
    btnSidebarSearchInquiry.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('侧边栏搜索询价按钮被点击');
      const keyword = getElement('sidebar-inquiry-id')?.value || '';
      performSidebarSearch('inquiry', keyword);
    });
  }
  
  // 供应商搜索按钮
  const btnSidebarSearchSupplier = getElement('btn-sidebar-search-supplier');
  console.log('供应商搜索按钮:', btnSidebarSearchSupplier ? '找到' : '未找到');
  if (btnSidebarSearchSupplier) {
    btnSidebarSearchSupplier.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('侧边栏搜索供应商按钮被点击');
      const keyword = getElement('sidebar-supplier-id')?.value || '';
      performSidebarSearch('supplier', keyword);
    });
  }
  
  // 更换按钮
  const btnSidebarChangeInquiry = getElement('btn-sidebar-change-inquiry');
  if (btnSidebarChangeInquiry) {
    btnSidebarChangeInquiry.addEventListener('click', () => {
      selectedInquiry = null;
      const selectedEl = getElement('sidebar-selected-inquiry');
      const inputEl = getElement('sidebar-inquiry-id');
      if (selectedEl) selectedEl.style.display = 'none';
      if (inputEl) inputEl.value = '';
      updateSidebarConfirmButton();
    });
  }
  
  const btnSidebarChangeSupplier = getElement('btn-sidebar-change-supplier');
  if (btnSidebarChangeSupplier) {
    btnSidebarChangeSupplier.addEventListener('click', () => {
      selectedSupplier = null;
      const selectedEl = getElement('sidebar-selected-supplier');
      const inputEl = getElement('sidebar-supplier-id');
      if (selectedEl) selectedEl.style.display = 'none';
      if (inputEl) inputEl.value = '';
      updateSidebarConfirmButton();
    });
  }
  
  // 输入框防抖搜索
  getElement('sidebar-inquiry-id')?.addEventListener('input', (e) => {
    clearTimeout(dropdownDebounceTimer);
    dropdownDebounceTimer = setTimeout(() => {
      performSidebarSearch('inquiry', e.target.value);
    }, 300);
  });
  
  getElement('sidebar-supplier-id')?.addEventListener('input', (e) => {
    clearTimeout(dropdownDebounceTimer);
    dropdownDebounceTimer = setTimeout(() => {
      performSidebarSearch('supplier', e.target.value);
    }, 300);
  });
  
  // 确认添加按钮
  const btnSidebarConfirm = getElement('btn-sidebar-confirm');
  if (btnSidebarConfirm) {
    btnSidebarConfirm.addEventListener('click', async () => {
      if (!selectedInquiry || !selectedSupplier) return;
      
      const quotationData = {
        userId: currentUserId,
        userName: currentUserName,
        messageId: currentEmail?.messageId || 'mock-msg-' + Date.now(),
        inquiryId: selectedInquiry.id,
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        emailId: currentEmail?.id || '',
        emailContent: currentEmail?.body || '',
        quoteDate: new Date().toISOString().split('T')[0],
        extractedData: {}
      };
      
      try {
        btnSidebarConfirm.disabled = true;
        btnSidebarConfirm.textContent = '添加中...';
        
        const res = await fetch(`${MCP_API_URL}/add_quotation_record`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ACCESS_PASSWORD}`
          },
          body: JSON.stringify(quotationData)
        });
        
        if (res.ok) {
          const data = await res.json();
          const quotationId = data.quotationId || '未知';
          
          // 在右侧侧边栏显示报价信息
          await showQuotationInPanel({
            quotationId,
            inquiryId: selectedInquiry.id,
            supplierName: selectedSupplier.name,
            isNew: true
          });
          
          addMessage(`✅ 报价已添加：${quotationId}，请在右侧查看详情`, false);
        } else {
          throw new Error('添加失败');
        }
      } catch (error) {
        console.error('添加报价失败:', error);
        addMessage(`❌ 添加报价失败：${error.message}`, false);
      } finally {
        btnSidebarConfirm.disabled = false;
        btnSidebarConfirm.textContent = '确认添加';
      }
    });
  }
  
  // 点击外部关闭下拉
  document.addEventListener('click', (e) => {
    const dropdownInquiry = getElement('sidebar-dropdown-inquiry');
    const dropdownSupplier = getElement('sidebar-dropdown-supplier');
    
    if (dropdownInquiry && !e.target.closest('#sidebar-inquiry-id') && !e.target.closest('#sidebar-dropdown-inquiry')) {
      dropdownInquiry.style.display = 'none';
    }
    if (dropdownSupplier && !e.target.closest('#sidebar-supplier-id') && !e.target.closest('#sidebar-dropdown-supplier')) {
      dropdownSupplier.style.display = 'none';
    }
  });
}

// 侧边栏搜索功能
async function performSidebarSearch(type, keyword) {
  console.log(`侧边栏搜索: type=${type}, keyword=${keyword}`);
  
  const dropdownId = type === 'inquiry' ? 'sidebar-dropdown-inquiry' : 'sidebar-dropdown-supplier';
  const dropdown = getElement(dropdownId);
  
  if (!dropdown) {
    console.error('下拉元素未找到:', dropdownId);
    return;
  }
  
  dropdown.innerHTML = '<div class="dropdown-loading">搜索中...</div>';
  dropdown.style.display = 'block';
  
  try {
    let results = [];
    
    if (type === 'inquiry') {
      const res = await fetch(`${MCP_API_URL}/search_inquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_PASSWORD}`
        },
        body: JSON.stringify({
          userId: currentUserId,
          keyword: keyword,
          page: 1,
          pageSize: 10
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        results = data.inquiries || [];
      }
    } else {
      const res = await fetch(`${MCP_API_URL}/search_supplier`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_PASSWORD}`
        },
        body: JSON.stringify({
          keyword: keyword,
          userId: currentUserId,
          page: 1,
          pageSize: 10
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        results = data.suppliers || [];
      }
    }
    
    // 渲染结果
    console.log('搜索结果:', results.length, '条');
    if (results.length === 0) {
      dropdown.innerHTML = '<div class="dropdown-empty">未找到结果</div>';
    } else {
      let html = results.map(item => {
        if (type === 'inquiry') {
          return `
            <div class="dropdown-item" data-id="${item.id}" data-type="inquiry">
              <div class="dropdown-item-title">${item.id}</div>
              <div class="dropdown-item-desc">${item.pol || '-'} → ${item.pod || '-'} | ${item.cargoName || '-'} | ${item.containerType || '-'}</div>
            </div>
          `;
        } else {
          return `
            <div class="dropdown-item" data-id="${item.id}" data-type="supplier">
              <div class="dropdown-item-title">${item.name}</div>
              <div class="dropdown-item-desc">${item.contact || '-'} | ${item.email || '-'}</div>
            </div>
          `;
        }
      }).join('');
      
      console.log('渲染HTML:', html.substring(0, 200));
      dropdown.innerHTML = html;
      console.log('下拉列表内容已设置, display:', dropdown.style.display);
      
      // 绑定点击事件
      dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.id;
          const itemType = item.dataset.type;
          
          if (itemType === 'inquiry') {
            selectedInquiry = results.find(r => r.id === id);
            const inputEl = getElement('sidebar-inquiry-id');
            const selectedIdEl = getElement('sidebar-selected-inquiry-id');
            const selectedEl = getElement('sidebar-selected-inquiry');
            if (inputEl) inputEl.value = selectedInquiry.id;
            if (selectedIdEl) selectedIdEl.textContent = selectedInquiry.id;
            if (selectedEl) selectedEl.style.display = 'flex';
          } else {
            selectedSupplier = results.find(r => r.id === id);
            const inputEl = getElement('sidebar-supplier-id');
            const selectedNameEl = getElement('sidebar-selected-supplier-name');
            const selectedEl = getElement('sidebar-selected-supplier');
            if (inputEl) inputEl.value = selectedSupplier.name;
            if (selectedNameEl) selectedNameEl.textContent = selectedSupplier.name;
            if (selectedEl) selectedEl.style.display = 'flex';
          }
          
          dropdown.style.display = 'none';
          updateSidebarConfirmButton();
        });
      });
    }
  } catch (error) {
    console.error('搜索失败:', error);
    dropdown.innerHTML = '<div class="dropdown-error">搜索失败，请重试</div>';
  }
}

// 更新侧边栏确认按钮状态
function updateSidebarConfirmButton() {
  const btnSidebarConfirm = getElement('btn-sidebar-confirm');
  if (btnSidebarConfirm) {
    btnSidebarConfirm.disabled = !(selectedInquiry && selectedSupplier);
  }
}

// 在右侧侧边栏显示报价信息（询价在上，报价在下）
async function showQuotationInPanel(newQuotation = null) {
  console.log('showQuotationInPanel 被调用:', newQuotation);
  
  if (!quotationSidebar || !inquiryInfoContent || !quotationListContent) {
    console.error('报价侧边栏元素未找到，无法显示');
    if (newQuotation) {
      addMessage(`✅ 报价已添加：${newQuotation.quotationId}`, false);
    }
    return;
  }
  
  // 隐藏添加报价侧边栏
  if (addQuotationSidebar) addQuotationSidebar.style.display = 'none';
  
  // 显示报价侧边栏
  quotationSidebar.style.display = 'flex';
  
  const inquiryId = newQuotation?.inquiryId;
  
  // 1. 先加载询价信息（上面）
  if (inquiryId) {
    try {
      // 查询询价信息
      const inquiryRes = await fetch(`${MCP_API_URL}/search_inquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_PASSWORD}`
        },
        body: JSON.stringify({
          userId: currentUserId,
          keyword: inquiryId,
          page: 1,
          pageSize: 1
        })
      });
      
      if (inquiryRes.ok) {
        const inquiryData = await inquiryRes.json();
        const inquiries = inquiryData.inquiries || [];
        
        if (inquiries.length > 0) {
          const inquiry = inquiries[0];
          inquiryInfoSection.style.display = 'block';
          inquiryInfoContent.innerHTML = `
            <div class="quotation-card">
              <div class="quotation-card-title">${inquiry.id}</div>
              <div class="quotation-card-info">
                <strong>路线：</strong>${inquiry.pol || '-'} → ${inquiry.pod || '-'}<br>
                <strong>货物：</strong>${inquiry.cargoName || '-'}<br>
                <strong>箱型：</strong>${inquiry.containerType || '-'}<br>
                <strong>状态：</strong>${inquiry.status || '-'}
              </div>
            </div>
          `;
        } else {
          inquiryInfoSection.style.display = 'none';
        }
      }
    } catch (error) {
      console.error('查询询价信息失败:', error);
      inquiryInfoSection.style.display = 'none';
    }
  }
  
  // 2. 加载报价列表（下面）
  if (inquiryId) {
    await loadQuotationsForInquiry(inquiryId);
  }
}

// 加载指定询价单的报价列表
async function loadQuotationsForInquiry(inquiryId) {
  console.log('loadQuotationsForInquiry 被调用:', inquiryId);
  
  if (!quotationSidebar || !quotationListContent) {
    console.error('报价侧边栏元素未找到');
    return;
  }
  
  // 隐藏其他侧边栏
  if (myInquiriesSidebar) myInquiriesSidebar.style.display = 'none';
  if (addQuotationSidebar) addQuotationSidebar.style.display = 'none';
  
  // 显示报价侧边栏
  quotationSidebar.style.display = 'flex';
  
  // 隐藏询价信息区域（因为是从询价列表点击进来的）
  if (inquiryInfoSection) inquiryInfoSection.style.display = 'none';
  
  // 显示标题
  const sectionTitle = quotationSidebar.querySelector('.section-title');
  if (sectionTitle) sectionTitle.textContent = `💰 询价单 ${inquiryId} 的报价记录`;
  
  quotationListContent.innerHTML = '<div class="quotation-empty">加载中...</div>';
  
  try {
    const res = await fetch(`${MCP_API_URL}/get_quotations_by_inquiry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_PASSWORD}`
      },
      body: JSON.stringify({
        inquiryId: inquiryId,
        userId: currentUserId
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      const quotations = data.quotations || [];
      
      if (quotations.length > 0) {
        quotationListContent.innerHTML = quotations.map((q, index) => `
          <div class="quotation-card">
            <div class="quotation-card-title">#${index + 1} ${q.id}</div>
            <div class="quotation-card-info">
              <strong>供应商：</strong>${q.supplierName}<br>
              <strong>报价时间：</strong>${new Date(q.createdAt).toLocaleString()}<br>
              ${q.freightCost ? `<strong>运费：</strong>${q.freightCost}<br>` : ''}
              ${q.validityDate ? `<strong>有效期：</strong>${q.validityDate}<br>` : ''}
            </div>
          </div>
        `).join('');
      } else {
        quotationListContent.innerHTML = `<div class="quotation-empty">暂无报价记录</div>`;
      }
    } else {
      quotationListContent.innerHTML = `<div class="quotation-empty">加载失败</div>`;
    }
  } catch (error) {
    console.error('加载报价失败:', error);
    quotationListContent.innerHTML = `<div class="quotation-empty">加载失败: ${error.message}</div>`;
  }
}

// 将函数暴露到全局，供 HTML 中的 onclick 调用
window.loadQuotationsForInquiry = loadQuotationsForInquiry;

// ========== 我的询价列表 ==========
const myInquiriesSidebar = getElement('my-inquiries-sidebar');
const myInquiriesContent = getElement('my-inquiries-content');
const btnCloseMyInquiries = getElement('btn-close-my-inquiries');

// 关闭我的询价侧边栏
if (btnCloseMyInquiries) {
  btnCloseMyInquiries.addEventListener('click', () => {
    if (myInquiriesSidebar) myInquiriesSidebar.style.display = 'none';
  });
}

// 存储当前询价列表数据
let currentInquiriesData = [];

// 渲染询价列表函数
function renderInquiriesList(inquiries) {
  if (!myInquiriesContent) return;
  
  if (inquiries.length === 0) {
    myInquiriesContent.innerHTML = '<div class="quotation-empty">暂无询价记录</div>';
    return;
  }
  
  // 渲染询价列表
  myInquiriesContent.innerHTML = inquiries.map((item, index) => `
    <div class="quotation-card" data-inquiry-id="${item.id}">
      <div class="quotation-card-title">#${index + 1} ${item.id}</div>
      <div class="quotation-card-info">
        <strong>路线：</strong>${item.pol || '-'} → ${item.pod || '-'}<br>
        <strong>货物：</strong>${item.cargoName || '-'}<br>
        <strong>箱型：</strong>${item.containerType || '-'}<br>
        <strong>状态：</strong>${item.status || '-'}<br>
        <strong>日期：</strong>${item.inquiryDate || '-'}
      </div>
      <div class="quotation-actions">
        <button class="btn-view" data-action="view" data-inquiry-id="${item.id}">查看报价</button>
        <button class="btn-add" data-action="add" data-inquiry-id="${item.id}">添加报价</button>
      </div>
    </div>
  `).join('');
  
  // 绑定按钮点击事件（事件委托）
  myInquiriesContent.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const inquiryId = btn.dataset.inquiryId;
      console.log('查看报价按钮点击:', inquiryId);
      loadQuotationsForInquiry(inquiryId);
    });
  });
  
  myInquiriesContent.querySelectorAll('.btn-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const inquiryId = btn.dataset.inquiryId;
      console.log('添加报价按钮点击:', inquiryId);
      showAddQuotationForInquiry(inquiryId);
    });
  });
}

// 搜索询价列表函数
function filterInquiries(keyword) {
  // 保存搜索关键词
  myInquiriesSearchState.keyword = keyword || '';
  
  if (!keyword || keyword.trim() === '') {
    myInquiriesSearchState.filteredData = currentInquiriesData;
    renderInquiriesList(currentInquiriesData);
    return;
  }
  
  const lowerKeyword = keyword.toLowerCase().trim();
  const filtered = currentInquiriesData.filter(item => {
    return (
      (item.id && item.id.toLowerCase().includes(lowerKeyword)) ||
      (item.pol && item.pol.toLowerCase().includes(lowerKeyword)) ||
      (item.pod && item.pod.toLowerCase().includes(lowerKeyword)) ||
      (item.cargoName && item.cargoName.toLowerCase().includes(lowerKeyword)) ||
      (item.containerType && item.containerType.toLowerCase().includes(lowerKeyword)) ||
      (item.status && item.status.toLowerCase().includes(lowerKeyword))
    );
  });
  
  // 保存过滤后的数据
  myInquiriesSearchState.filteredData = filtered;
  renderInquiriesList(filtered);
}

const btnMyInquiries = document.getElementById('btn-my-inquiries');
if (btnMyInquiries) {
  btnMyInquiries.addEventListener('click', async () => {
    if (!myInquiriesSidebar || !myInquiriesContent) {
      console.error('我的询价侧边栏元素未找到');
      return;
    }
    
    // 隐藏其他侧边栏
    if (quotationSidebar) quotationSidebar.style.display = 'none';
    if (addQuotationSidebar) addQuotationSidebar.style.display = 'none';
    
    // 显示我的询价侧边栏
    myInquiriesSidebar.style.display = 'flex';
    myInquiriesContent.innerHTML = '<div class="quotation-empty">加载中...</div>';
    
    // 清空搜索框
    const searchInput = document.getElementById('my-inquiries-search');
    if (searchInput) searchInput.value = '';
    
    console.log('当前 MCP_API_URL:', MCP_API_URL);
    console.log('当前 userId:', currentUserId);
    
    try {
      const requestUrl = `${MCP_API_URL}/get_my_inquiries`;
      console.log('请求 URL:', requestUrl);
      const res = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_PASSWORD}`
        },
        body: JSON.stringify({
          userId: currentUserId,
          limit: 100
        })
      });
      
      console.log('获取询价列表响应:', res.status, res.statusText);
      
      if (res.ok) {
        const data = await res.json();
        console.log('获取询价列表数据:', data);
        currentInquiriesData = data.inquiries || [];
        
        renderInquiriesList(currentInquiriesData);
      } else {
        const errorText = await res.text();
        console.error('获取询价列表失败:', res.status, errorText);
        throw new Error(`HTTP ${res.status}: ${errorText || '获取失败'}`);
      }
    } catch (error) {
      console.error('获取询价列表失败:', error);
      myInquiriesContent.innerHTML = `<div class="quotation-empty">获取失败: ${error.message}</div>`;
    }
  });
}

// 搜索按钮事件
const btnSearchMyInquiries = document.getElementById('btn-search-my-inquiries');
const myInquiriesSearchInput = document.getElementById('my-inquiries-search');

if (btnSearchMyInquiries && myInquiriesSearchInput) {
  btnSearchMyInquiries.addEventListener('click', () => {
    const keyword = myInquiriesSearchInput.value;
    console.log('搜索询价:', keyword);
    filterInquiries(keyword);
  });
  
  // 支持回车键搜索
  myInquiriesSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const keyword = myInquiriesSearchInput.value;
      console.log('搜索询价 (回车):', keyword);
      filterInquiries(keyword);
    }
  });
}

// 为指定询价单显示添加报价侧边栏
function showAddQuotationForInquiry(inquiryId) {
  // 先搜索该询价单信息
  fetch(`${MCP_API_URL}/search_inquiries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_PASSWORD}`
    },
    body: JSON.stringify({
      userId: currentUserId,
      keyword: inquiryId,
      page: 1,
      pageSize: 1
    })
  })
  .then(res => res.json())
  .then(data => {
    const inquiries = data.inquiries || [];
    if (inquiries.length > 0) {
      selectedInquiry = inquiries[0];
      
      // 隐藏其他侧边栏
      if (myInquiriesSidebar) myInquiriesSidebar.style.display = 'none';
      if (quotationSidebar) quotationSidebar.style.display = 'none';
      
      // 显示添加报价侧边栏并填充询价信息
      if (addQuotationSidebar) {
        addQuotationSidebar.style.display = 'flex';
        bindSidebarSearchEvents();
        
        const inputEl = getElement('sidebar-inquiry-id');
        const selectedIdEl = getElement('sidebar-selected-inquiry-id');
        const selectedEl = getElement('sidebar-selected-inquiry');
        
        if (inputEl) inputEl.value = selectedInquiry.id;
        if (selectedIdEl) selectedIdEl.textContent = selectedInquiry.id;
        if (selectedEl) selectedEl.style.display = 'flex';
        
        updateSidebarConfirmButton();
      }
    }
  })
  .catch(error => {
    console.error('加载询价信息失败:', error);
  });
}

// 暴露到全局
window.showAddQuotationForInquiry = showAddQuotationForInquiry;

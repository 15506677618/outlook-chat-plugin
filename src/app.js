const API_URL = '/api/chat';

// DOM 元素
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// 搜索弹窗元素
const searchModal = document.getElementById('search-modal');
const modalTitle = document.getElementById('modal-title');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const modalClose = document.getElementById('modal-close');
const modalCancel = document.getElementById('modal-cancel');

// 状态
let conversationHistory = [];
let currentEmail = null;
let currentSearchType = ''; // 'inquiry' 或 'supplier'
let currentSearchResolve = null;
let searchDebounceTimer = null;

// 监听来自 Thunderbird 插件的邮件数据
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'emailContent') {
    currentEmail = event.data;
    
    // 显示邮件加载提示
    addMessage(`📧 **已加载邮件**

**主题：** ${currentEmail.subject}
**发件人：** ${currentEmail.from}
**日期：** ${currentEmail.date}

您可以询问我关于这封邮件的任何问题，例如：
- "这封邮件的主要内容是什么？"
- "帮我总结一下邮件内容"
- "发件人提到了哪些重点？"`, false);
  }
});

function addMessage(content, isUser = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = isUser ? '👤' : '🤖';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';

  const paragraph = document.createElement('p');
  paragraph.innerHTML = content;

  contentDiv.appendChild(paragraph);
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  return contentDiv;
}

function addTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message bot';
  typingDiv.id = 'typing-indicator';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = '🤖';

  const typingInner = document.createElement('div');
  typingInner.className = 'typing';
  typingInner.innerHTML = '<span></span><span></span><span></span>';

  typingDiv.appendChild(avatar);
  typingDiv.appendChild(typingInner);
  messagesContainer.appendChild(typingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) {
    indicator.remove();
  }
}

function getEmailContext() {
  if (!currentEmail) return '';
  
  return `
【当前邮件内容】
主题：${currentEmail.subject}
发件人：${currentEmail.from}
日期：${currentEmail.date}
内容：
${currentEmail.body}
`;
}

async function sendMessage() {
  const message = userInput.value.trim();

  if (!message) return;

  addMessage(message, true);
  
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
      },
      body: JSON.stringify({
        messages: conversationHistory,
        userMessage: message,
        emailContext: currentEmail || null
      })
    });

    removeTypingIndicator();

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const botMessage = data.response || data.message || '抱歉，我没有收到回复。';

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

// 加载邮件按钮处理
const loadEmailBtn = document.getElementById('load-email-btn');
if (loadEmailBtn) {
  loadEmailBtn.addEventListener('click', async () => {
    // 检查是否在 Thunderbird 扩展环境中
    if (typeof browser !== 'undefined' && browser.runtime) {
      // Thunderbird 环境 - 请求 background.js 获取当前邮件
      browser.runtime.sendMessage({ type: 'getEmailContent' }).then(response => {
        if (response && response.content) {
          currentEmail = response.content;
          addMessage(`📧 **已加载邮件**

**主题：** ${currentEmail.subject || '-'}
**发件人：** ${currentEmail.from || '-'}
**日期：** ${currentEmail.date || '-'}

您可以询问我关于这封邮件的任何问题！`, false);
        } else {
          addMessage('⚠️ 当前没有打开的邮件，请在Thunderbird中选择一封邮件。', false);
        }
      }).catch(error => {
        addMessage(`❌ 加载邮件失败：${error.message}`, false);
      });
    } else {
      // Web 环境 - 提示用户或加载示例邮件
      addMessage(`📧 **演示模式**

这是 Web 演示版本。在 Thunderbird 中使用时，可以自动加载当前查看的邮件。

您可以尝试询问：
- "帮我分析当前邮件"
- "提取邮件中的关键信息"`, false);
    }
  });
}

// 搜索弹窗相关函数
function openSearchModal(type, title) {
  return new Promise((resolve) => {
    currentSearchType = type;
    currentSearchResolve = resolve;
    modalTitle.textContent = title;
    searchInput.value = '';
    searchResults.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">请输入关键词搜索</div>';
    searchModal.style.display = 'flex';
    searchInput.focus();
  });
}

function closeSearchModal() {
  searchModal.style.display = 'none';
  currentSearchResolve = null;
  currentSearchType = '';
}

async function performSearch(keyword) {
  if (!keyword.trim()) {
    searchResults.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">请输入关键词搜索</div>';
    return;
  }

  try {
    const toolName = currentSearchType === 'inquiry' ? 'search_inquiry' : 'search_supplier';
    const response = await fetch('/api/mcp/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: toolName,
        parameters: { keyword }
      })
    });

    const data = await response.json();
    const result = data.result || {};
    
    // 根据搜索类型获取结果列表
    const items = currentSearchType === 'inquiry' ? (result.inquiries || []) : (result.suppliers || []);
    
    if (!items.length) {
      searchResults.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">未找到匹配结果</div>';
      return;
    }

    searchResults.innerHTML = items.map(item => {
      if (currentSearchType === 'inquiry') {
        return `<div class="search-result-item" data-id="${item.id}">
          <div class="item-title">${item.id}</div>
          <div class="item-desc">${item.customerName} - ${item.pol || ''}→${item.pod || ''} - ${item.cargoName || ''} (${item.containerType || ''})</div>
        </div>`;
      } else {
        return `<div class="search-result-item" data-id="${item.id}">
          <div class="item-title">${item.name}</div>
          <div class="item-desc">${item.contact} - ${item.email}</div>
        </div>`;
      }
    }).join('');

    // 添加点击事件
    searchResults.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        searchResults.querySelectorAll('.search-result-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        const id = item.dataset.id;
        const title = item.querySelector('.item-title').textContent;
        currentSearchResolve({ id, title });
        closeSearchModal();
      });
    });

  } catch (error) {
    searchResults.innerHTML = `<div style="color:#f44336;text-align:center;padding:20px;">搜索失败: ${error.message}</div>`;
  }
}

// 搜索输入防抖
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    performSearch(searchInput.value);
  }, 300);
});

// 关闭弹窗事件
modalClose.addEventListener('click', closeSearchModal);
modalCancel.addEventListener('click', () => {
  currentSearchResolve && currentSearchResolve(null);
  closeSearchModal();
});

// ESC 关闭弹窗
searchModal.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSearchModal();
});

// 点击遮罩关闭
searchModal.addEventListener('click', (e) => {
  if (e.target === searchModal) {
    currentSearchResolve && currentSearchResolve(null);
    closeSearchModal();
  }
});

// 导出搜索函数供外部调用
window.searchInquiry = () => openSearchModal('inquiry', '搜索询价记录');
window.searchSupplier = () => openSearchModal('supplier', '搜索供应商');

// 初始化
userInput.focus();

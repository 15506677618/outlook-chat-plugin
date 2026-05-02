// Chat window script

// API URL 配置
const API_URL = 'https://koudai.xin/api/chat';
const ACCESS_PASSWORD = 'koudai123'; // 访问密码 - 注意：客户端密码仅用于简单验证，生产环境应使用更安全的方式

// DOM 元素
const emailFromEl = document.getElementById('email-from');
const emailDateEl = document.getElementById('email-date');
const emailBodyEl = document.getElementById('email-body');
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const cancelBtn = document.getElementById('cancel-btn');
const quickButtons = document.querySelectorAll('.quick-btn');
const inquiryListBtn = document.getElementById('inquiry-list-btn');
const inquiryPanel = document.getElementById('inquiry-panel');
const closeInquiryPanelBtn = document.getElementById('close-inquiry-panel');
const inquirySearchInput = document.getElementById('inquiry-search');
const inquiryListContainer = document.getElementById('inquiry-list');

// 状态
let conversationHistory = [];
let currentEmail = null;
let userEmail = null; // 用户邮箱
let abortController = null; // 用于取消请求

// 监听来自 background.js 的邮件数据
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message);
  
  if (message.type === 'emailContent') {
    currentEmail = message;
    userEmail = message.userEmail || null; // 保存用户邮箱
    displayEmail(currentEmail);
    
    // 构建欢迎消息
    let welcomeMsg = `📧 **已加载邮件**

**主题：** ${currentEmail.subject}
**发件人：** ${currentEmail.from}
**日期：** ${currentEmail.date}`;
    
    // 如果有会话历史，显示邮件数量
    if (currentEmail.conversation && currentEmail.conversation.length > 1) {
      welcomeMsg += `\n\n📨 **此邮件会话共 ${currentEmail.conversation.length} 封邮件**`;
    }
    
    welcomeMsg += `\n\n您可以询问我关于这封邮件的任何问题！`;
    
    addMessage(welcomeMsg, false);
    
    sendResponse({success: true});
  }
  
  return true;
});

function displayEmail(email) {
  console.log('显示邮件:', email);
  
  // 如果有会话历史，显示完整的会话
  if (email.conversation && email.conversation.length > 0) {
    // 显示原始邮件（第一封）
    const originalEmail = email.conversation[0];
    if (emailFromEl) emailFromEl.textContent = originalEmail.from || '-';
    if (emailDateEl) emailDateEl.textContent = originalEmail.date || '-';
    
    // 构建完整的会话内容
    let fullContent = '';
    email.conversation.forEach((msg, index) => {
      const prefix = msg.isReply ? '【回复】' : '【原始】';
      fullContent += `${prefix} ${msg.from} (${msg.date}):\n${msg.body}\n\n${'='.repeat(50)}\n\n`;
    });
    
    if (emailBodyEl) emailBodyEl.textContent = fullContent.trim();
  } else if (email.from) {
    // 没有会话历史但有邮件基本信息，显示当前邮件
    if (emailFromEl) emailFromEl.textContent = email.from || '-';
    if (emailDateEl) emailDateEl.textContent = email.date || '-';
    if (emailBodyEl) emailBodyEl.textContent = '（无法获取邮件内容）';
  } else {
    // 没有任何邮件信息
    if (emailFromEl) emailFromEl.textContent = '-';
    if (emailDateEl) emailDateEl.textContent = '-';
    if (emailBodyEl) emailBodyEl.textContent = '（无内容）';
  }
}

function formatMessage(content) {
  // 如果内容已经包含 HTML 标签，清理多余的空白
  if (/<[a-z][\s\S]*>/i.test(content)) {
    // 移除标签之间的多余换行和空格
    return content
      .replace(/>\s+</g, '><')  // 移除标签之间的空白
      .replace(/\n\s*\n/g, '\n')  // 移除连续空行
      .trim();
  }
  
  // 将 ### 标题 转换为 <h3>标题</h3>
  let formatted = content.replace(/###\s+(.+?)(?=\n|$)/g, '<h3 style="margin: 8px 0 4px 0; color: #333; font-size: 15px;">$1</h3>');
  
  // 将 ## 标题 转换为 <h2>标题</h2>
  formatted = formatted.replace(/##\s+(.+?)(?=\n|$)/g, '<h2 style="margin: 10px 0 6px 0; color: #333; font-size: 16px;">$1</h2>');
  
  // 将 # 标题 转换为 <h1>标题</h1>
  formatted = formatted.replace(/#\s+(.+?)(?=\n|$)/g, '<h1 style="margin: 12px 0 8px 0; color: #333; font-size: 18px;">$1</h1>');
  
  // 将 **文本** 转换为 <strong>文本</strong>
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong style="color: #333;">$1</strong>');
  
  // 将多个换行符转换为单个 <br>
  formatted = formatted.replace(/\n\s*\n/g, '<br>');
  formatted = formatted.replace(/\n/g, '<br>');
  
  return formatted;
}

function addMessage(content, isUser = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
  
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = isUser ? '👤' : '🤖';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';
  
  const paragraph = document.createElement('p');
  paragraph.innerHTML = formatMessage(content);
  paragraph.style.whiteSpace = 'pre-wrap';
  paragraph.style.wordWrap = 'break-word';
  
  contentDiv.appendChild(paragraph);
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);
  
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  console.log('添加消息:', content.substring(0, 50));
  
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

function showCancelButton() {
  sendBtn.classList.add('hidden');
  cancelBtn.classList.add('visible');
}

function hideCancelButton() {
  sendBtn.classList.remove('hidden');
  cancelBtn.classList.remove('visible');
}

function cancelRequest() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  removeTypingIndicator();
  hideCancelButton();
  addMessage('❌ 已取消请求');
}

async function sendMessage() {
  const message = userInput.value.trim();
  
  if (!message) {
    console.log('消息为空');
    return;
  }
  
  console.log('发送消息:', message);
  addMessage(message, true);
  
  // 构建简洁的对话历史，只包含必要的上下文
  const messagesToSend = [];
  
  // 如果有邮件，添加上下文提示
  if (currentEmail) {
    let emailContext = `你正在帮助用户分析邮件。
邮件主题：${currentEmail.subject}
发件人：${currentEmail.from}
日期：${currentEmail.date}

`;
    
    // 如果有会话历史，添加完整会话
    if (currentEmail.conversation && currentEmail.conversation.length > 0) {
      emailContext += `=== 邮件会话历史 ===\n\n`;
      currentEmail.conversation.forEach((msg, index) => {
        const type = msg.isReply ? '【回复】' : '【原始邮件】';
        emailContext += `${type} 发件人：${msg.from}\n日期：${msg.date}\n内容：\n${msg.body}\n\n---\n\n`;
      });
      emailContext += `=== 会话结束 ===\n\n`;
    }
    
    emailContext += `当用户询问邮件相关内容时，请基于以上邮件信息进行回答。注意区分原始邮件和回复邮件的内容。保持回答简洁专业。`;
    
    messagesToSend.push({
      role: 'system',
      content: emailContext
    });
  }
  
  // 添加对话历史（限制最近 10 条消息）
  const recentHistory = conversationHistory.slice(-10);
  messagesToSend.push(...recentHistory);
  
  // 添加当前用户消息
  messagesToSend.push({ role: 'user', content: message });
  
  conversationHistory.push({ role: 'user', content: message });
  
  userInput.value = '';
  userInput.style.height = 'auto';
  
  addTypingIndicator();
  showCancelButton();

  // 创建 AbortController 用于取消请求
  abortController = new AbortController();

  let fullMessage = '';
  let messageDiv = null;

  try {
    console.log('发送 API 请求到:', API_URL);
    console.log('请求数据:', JSON.stringify({ messages: messagesToSend }, null, 2));

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_PASSWORD}`
      },
      body: JSON.stringify({
        messages: messagesToSend,
        userMessage: message,
        userEmail: userEmail // 传递用户邮箱作为标识
      })
    });

    console.log('API 响应状态:', response.status);
    removeTypingIndicator();

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // 检查是否是流式响应
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/event-stream')) {
      // 流式响应处理
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // 创建消息元素用于流式显示
      messageDiv = addStreamingMessage();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.content || '';
              if (content) {
                fullMessage += content;
                updateStreamingMessage(messageDiv, fullMessage);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      // 流式输出完成
      hideCancelButton();
      conversationHistory.push({ role: 'assistant', content: fullMessage });
    } else {
      // 非流式响应（兼容旧版本）
      hideCancelButton();
      const data = await response.json();
      const botMessage = data.response || data.message || '抱歉，我没有收到回复。';

      console.log('收到回复:', botMessage.substring(0, 50));

      conversationHistory.push({ role: 'assistant', content: botMessage });
      addMessage(botMessage);
    }

  } catch (error) {
    removeTypingIndicator();
    hideCancelButton();

    if (error.name === 'AbortError') {
      console.log('请求被取消');
      if (messageDiv && fullMessage) {
        // 保留已接收的内容
        conversationHistory.push({ role: 'assistant', content: fullMessage + '\n\n[已取消]' });
      }
      return;
    }

    const errorMessage = `❌ 发送失败：${error.message}。请检查网络连接。`;
    addMessage(errorMessage);

    console.error('聊天错误:', error);
  } finally {
    abortController = null;
  }
}

// 添加流式消息元素
function addStreamingMessage() {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message bot';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = '🤖';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';

  const paragraph = document.createElement('p');
  paragraph.id = 'streaming-content';
  paragraph.style.whiteSpace = 'pre-wrap';
  paragraph.style.wordWrap = 'break-word';

  contentDiv.appendChild(paragraph);
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  return paragraph;
}

// 更新流式消息内容
function updateStreamingMessage(paragraph, content) {
  paragraph.innerHTML = formatMessage(content);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 询价列表相关函数
function openInquiryPanel() {
  inquiryPanel.classList.add('open');
  loadInquiryList();
}

function closeInquiryPanel() {
  inquiryPanel.classList.remove('open');
}

// MCP 服务地址（通过主服务代理）
const MCP_API_URL = 'https://koudai.xin/api';

async function loadInquiryList(keyword = '') {
  try {
    const response = await fetch(`${MCP_API_URL}/mcp/resources/inquiries`);
    if (!response.ok) throw new Error('加载失败');
    
    const inquiries = await response.json();
    
    // 过滤
    let filtered = inquiries;
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      filtered = inquiries.filter(i => 
        i.id.toLowerCase().includes(lowerKeyword) ||
        i.emailSubject?.toLowerCase().includes(lowerKeyword) ||
        i.pol?.toLowerCase().includes(lowerKeyword) ||
        i.pod?.toLowerCase().includes(lowerKeyword) ||
        i.cargoName?.toLowerCase().includes(lowerKeyword)
      );
    }
    
    // 渲染列表
    inquiryListContainer.innerHTML = filtered.length === 0 
      ? '<div style="text-align: center; padding: 20px; color: #999;">暂无询价记录</div>'
      : filtered.map(i => `
        <div class="inquiry-item" data-id="${i.id}">
          <div class="inquiry-id">${i.id}</div>
          <div class="inquiry-route">${i.pol || '-'} → ${i.pod || '-'}</div>
          <div class="inquiry-cargo">${i.cargoName || '-'} ${i.containerType || ''}</div>
          <div class="inquiry-date">${i.inquiryDate || '-'}</div>
        </div>
      `).join('');
    
    // 绑定点击事件
    document.querySelectorAll('.inquiry-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        userInput.value = `查看询价 ${id} 的详情`;
        closeInquiryPanel();
        userInput.focus();
      });
    });
    
  } catch (error) {
    console.error('加载询价列表失败:', error);
    inquiryListContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">加载失败</div>';
  }
}

function setupEventListeners() {
  sendBtn.addEventListener('click', sendMessage);
  console.log('发送按钮事件已设置');
  
  // 取消按钮事件
  cancelBtn.addEventListener('click', cancelRequest);
  console.log('取消按钮事件已设置');
  
  // 快捷键按钮事件
  quickButtons.forEach(btn => {
    if (btn.id === 'inquiry-list-btn') return; // 跳过询价列表按钮
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-text');
      userInput.value = text;
      userInput.focus();
      userInput.style.height = 'auto';
      userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
    });
  });
  console.log('快捷键按钮事件已设置');
  
  // 询价列表按钮事件
  inquiryListBtn.addEventListener('click', openInquiryPanel);
  closeInquiryPanelBtn.addEventListener('click', closeInquiryPanel);
  
  // 搜索框事件
  inquirySearchInput.addEventListener('input', (e) => {
    loadInquiryList(e.target.value);
  });
  
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
  });
  
  console.log('事件监听器已设置');
}

// 初始化
console.log('聊天窗口脚本开始加载');
setupEventListeners();
console.log('聊天窗口初始化完成');

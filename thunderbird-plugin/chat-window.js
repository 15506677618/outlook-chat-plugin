// Chat window script

const API_URL = 'https://koudai.xin/api/chat';

// DOM 元素
const emailFromEl = document.getElementById('email-from');
const emailDateEl = document.getElementById('email-date');
const emailBodyEl = document.getElementById('email-body');
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// 状态
let conversationHistory = [];
let currentEmail = null;

// 监听来自 background.js 的邮件数据
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message);
  
  if (message.type === 'emailContent') {
    currentEmail = message;
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
  // 将 **文本** 转换为 <strong>文本</strong>
  let formatted = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // 将换行符转换为 <br>
  formatted = formatted.replace(/\n/g, '<br>');
  
  // 将列表项（以数字. 或 - 开头）转换为 <li>
  formatted = formatted.replace(/^(\d+\.|\-)\s+(.+)$/gm, '<li>$2</li>');
  
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
  
  try {
    console.log('发送 API 请求到:', API_URL);
    console.log('请求数据:', JSON.stringify({ messages: messagesToSend }, null, 2));
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messagesToSend,
        userMessage: message
      })
    });
    
    console.log('API 响应状态:', response.status);
    removeTypingIndicator();
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const botMessage = data.response || data.message || '抱歉，我没有收到回复。';
    
    console.log('收到回复:', botMessage.substring(0, 50));
    
    conversationHistory.push({ role: 'assistant', content: botMessage });
    addMessage(botMessage);
    
  } catch (error) {
    removeTypingIndicator();
    
    const errorMessage = `❌ 发送失败：${error.message}。请检查网络连接。`;
    addMessage(errorMessage);
    
    console.error('聊天错误:', error);
  }
}

function setupEventListeners() {
  sendBtn.addEventListener('click', sendMessage);
  console.log('发送按钮事件已设置');
  
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

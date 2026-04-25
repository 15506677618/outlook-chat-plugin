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
    
    // 添加欢迎消息
    addMessage(`📧 **已加载邮件**

**主题：** ${currentEmail.subject}
**发件人：** ${currentEmail.from}
**日期：** ${currentEmail.date}

您可以询问我关于这封邮件的任何问题！`, false);
    
    sendResponse({success: true});
  }
  
  return true;
});

function displayEmail(email) {
  console.log('显示邮件:', email);
  
  if (emailFromEl) emailFromEl.textContent = email.from || '-';
  if (emailDateEl) emailDateEl.textContent = email.date || '-';
  if (emailBodyEl) emailBodyEl.textContent = email.body || '（无内容）';
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
  paragraph.innerHTML = content;
  
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
  
  if (!message) {
    console.log('消息为空');
    return;
  }
  
  console.log('发送消息:', message);
  addMessage(message, true);
  
  const emailContext = currentEmail ? getEmailContext() : '';
  const userMessageWithContext = emailContext 
    ? `${emailContext}\n\n用户问题：${message}`
    : message;
  
  conversationHistory.push({ role: 'user', content: userMessageWithContext });
  
  userInput.value = '';
  userInput.style.height = 'auto';
  
  addTypingIndicator();
  
  try {
    console.log('发送 API 请求到:', API_URL);
    
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

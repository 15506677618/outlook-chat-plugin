// Popup script for Thunderbird extension

const API_URL = 'https://koudai.xin/api/chat';

// DOM 元素
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const emailSubjectEl = document.getElementById('email-subject');
const emailFromEl = document.getElementById('email-from');
const emailDateEl = document.getElementById('email-date');

// 状态
let conversationHistory = [];
let currentEmail = null;

// 初始化
async function init() {
  await loadCurrentEmail();
  setupEventListeners();
}

// 加载当前邮件
async function loadCurrentEmail() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    
    if (tabs.length === 0) {
      setEmailInfo(null);
      return;
    }
    
    const currentTab = tabs[0];
    
    try {
      const message = await browser.messageDisplay.getDisplayedMessage(currentTab.id);
      
      if (!message) {
        setEmailInfo(null);
        return;
      }
      
      const fullMessage = await browser.messages.getFull(message.id);
      const body = extractEmailBody(fullMessage.parts);
      
      currentEmail = {
        id: message.id,
        subject: message.subject || '无主题',
        from: formatAuthor(message.author),
        date: formatDate(message.date),
        body: body || '（无内容）'
      };
      
      setEmailInfo(currentEmail);
      
      // 添加欢迎消息
      addMessage(`📧 **已加载邮件**

**主题：** ${currentEmail.subject}
**发件人：** ${currentEmail.from}

您可以询问我关于这封邮件的任何问题！`, false);
      
    } catch (e) {
      console.error('Error reading email:', e);
      setEmailInfo(null);
    }
  } catch (error) {
    console.error('Error getting tab:', error);
    setEmailInfo(null);
  }
}

function setEmailInfo(email) {
  if (!email) {
    emailSubjectEl.textContent = '-';
    emailFromEl.textContent = '-';
    emailDateEl.textContent = '-';
    return;
  }
  
  emailSubjectEl.textContent = email.subject;
  emailFromEl.textContent = email.from;
  emailDateEl.textContent = email.date;
}

function extractEmailBody(parts) {
  if (!parts) return '';
  
  for (const part of parts) {
    if (part.contentType === 'text/plain' && part.body) {
      return part.body.trim();
    } else if (part.contentType === 'text/html' && part.body) {
      const text = part.body
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
      if (text) return text;
    } else if (part.parts) {
      const result = extractEmailBody(part.parts);
      if (result) return result;
    }
  }
  return '';
}

function formatAuthor(author) {
  if (!author) return '未知';
  const match = author.match(/<(.+)>/);
  return match ? match[1] : author;
}

function formatDate(date) {
  if (!date) return '-';
  try {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    
    if (diff < 24 * 60 * 60 * 1000) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  } catch {
    return date;
  }
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
    
    conversationHistory.push({ role: 'assistant', content: botMessage });
    addMessage(botMessage);
    
  } catch (error) {
    removeTypingIndicator();
    
    const errorMessage = `❌ 发送失败：${error.message}。请检查网络连接。`;
    addMessage(errorMessage);
    
    console.error('Chat error:', error);
  }
}

function setupEventListeners() {
  sendBtn.addEventListener('click', sendMessage);
  
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 100) + 'px';
  });
}

// 启动
init();

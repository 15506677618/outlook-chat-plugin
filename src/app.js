const API_URL = '/api/chat';

// DOM 元素
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// 状态
let conversationHistory = [];
let currentEmail = null;

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

// 初始化
userInput.focus();

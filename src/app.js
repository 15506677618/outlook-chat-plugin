const API_URL = '/api/chat';

// DOM 元素
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const loadEmailBtn = document.getElementById('load-email-btn');

// 邮件元素
const emailFromEl = document.getElementById('email-from');
const emailSubjectEl = document.getElementById('email-subject');
const emailDateEl = document.getElementById('email-date');
const emailBodyEl = document.getElementById('email-body');

// 状态
let conversationHistory = [];
let currentEmail = null;

// 模拟邮件数据（实际使用时可以从 Outlook API 获取）
const mockEmail = {
  from: 'john.doe@example.com',
  subject: '项目进度更新 - Q1 季度报告',
  date: '2026-04-25 14:30',
  body: `您好，

这是关于 Q1 季度项目进度的更新报告。

主要完成的工作：
1. 完成了用户界面重构，提升了用户体验
2. 优化了后端 API 性能，响应时间减少了 40%
3. 新增了数据分析模块，支持实时报表生成

下一步计划：
- 继续优化系统性能
- 添加更多数据分析功能
- 改进移动端适配

如有任何问题，请随时联系我。

此致，
John Doe`
};

// 加载邮件内容
function loadEmail() {
  // 显示加载状态
  emailFromEl.textContent = '加载中...';
  emailSubjectEl.textContent = '加载中...';
  emailDateEl.textContent = '加载中...';
  emailBodyEl.innerHTML = '<p class="placeholder-text">正在加载邮件...</p>';

  // 模拟从 Outlook 获取邮件（实际使用时替换为真实 API 调用）
  setTimeout(() => {
    currentEmail = mockEmail;
    
    emailFromEl.textContent = currentEmail.from;
    emailSubjectEl.textContent = currentEmail.subject;
    emailDateEl.textContent = currentEmail.date;
    emailBodyEl.innerHTML = `<p>${currentEmail.body}</p>`;

    // 添加系统消息到聊天
    addMessage(`已加载邮件：**${currentEmail.subject}**

发件人：${currentEmail.from}
日期：${currentEmail.date}

您可以询问我关于这封邮件的任何问题，例如：
- "这封邮件的主要内容是什么？"
- "发件人提到了哪些下一步计划？"
- "帮我总结一下这封邮件"`, false);

  }, 500);
}

// 获取当前邮件内容（用于 AI 上下文）
function getEmailContext() {
  if (!currentEmail) return '';
  
  return `
【当前邮件内容】
发件人：${currentEmail.from}
主题：${currentEmail.subject}
日期：${currentEmail.date}
内容：
${currentEmail.body}
`;
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
  paragraph.innerHTML = content; // 支持简单的 markdown 格式

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
loadEmailBtn.addEventListener('click', loadEmail);

// 初始化
userInput.focus();

// 页面加载时自动加载邮件
window.addEventListener('DOMContentLoaded', () => {
  loadEmail();
});

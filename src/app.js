const API_URL = '/api/chat';

const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

let conversationHistory = [];

function addMessage(content, isUser = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = isUser ? '👤' : '🤖';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';

  const paragraph = document.createElement('p');
  paragraph.textContent = content;

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
  conversationHistory.push({ role: 'user', content: message });

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
        userMessage: message
      })
    });

    removeTypingIndicator();

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const botMessage = data.response || data.message || '抱歉，我没有收到回复。';

    addMessage(botMessage);
    conversationHistory.push({ role: 'assistant', content: botMessage });

  } catch (error) {
    removeTypingIndicator();

    const errorMessage = `❌ 发送失败: ${error.message}。请检查网络连接或后端服务是否运行。`;
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

userInput.addEventListener('keydown', handleKeyPress);
userInput.addEventListener('input', autoResize);
sendBtn.addEventListener('click', sendMessage);

userInput.focus();

// Sidebar script to get and display email content

const emailInfoBar = document.getElementById('email-info-bar');
const chatFrame = document.getElementById('chat-frame');

async function loadCurrentEmail() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });

    if (tabs.length === 0) {
      hideEmailInfo();
      return;
    }

    const currentTab = tabs[0];

    try {
      const message = await browser.messageDisplay.getDisplayedMessage(currentTab.id);

      if (!message) {
        hideEmailInfo();
        return;
      }

      const fullMessage = await browser.messages.getFull(message.id);
      const body = extractEmailBody(fullMessage.parts);

      showEmailInfo(message, body);
      sendToChat(message, body);

    } catch (e) {
      console.error('Error reading email:', e);
      hideEmailInfo();
    }
  } catch (error) {
    console.error('Error getting tab:', error);
    hideEmailInfo();
  }
}

function showEmailInfo(message, body) {
  const author = formatAuthor(message.author);
  const date = formatDate(message.date);
  const shortBody = (body || '').substring(0, 150);

  emailInfoBar.innerHTML = `
    <strong>主题:</strong> ${escapeHtml(message.subject || '无主题')} | 
    <strong>发件人:</strong> ${escapeHtml(author)} | 
    <strong>日期:</strong> ${date}
    <br><span style="color: #6c757d;">${escapeHtml(shortBody)}${body.length > 150 ? '...' : ''}</span>
  `;
  emailInfoBar.classList.add('show');
}

function hideEmailInfo() {
  emailInfoBar.classList.remove('show');
}

function extractEmailBody(parts) {
  if (!parts) return '';

  for (const part of parts) {
    if (part.contentType === 'text/plain' && part.body) {
      return part.body;
    } else if (part.contentType === 'text/html' && part.body) {
      return part.body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
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
    
    // 今天显示时间
    if (diff < 24 * 60 * 60 * 1000) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    // 其他显示日期
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  } catch {
    return date;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sendToChat(message, body) {
  const emailSummary = `邮件主题：${message.subject || '无主题'}\n发件人：${formatAuthor(message.author)}\n\n内容:\n${body || '（无内容）'}`;

  chatFrame.onload = () => {
    try {
      chatFrame.contentWindow.postMessage({
        type: 'emailContent',
        subject: message.subject,
        author: formatAuthor(message.author),
        body: body,
        fullText: emailSummary
      }, '*');
    } catch (e) {
      console.error('Failed to send to chat:', e);
    }
  };
}

// 监听邮件切换
browser.messageDisplay.onMessageDisplayed.addListener(loadCurrentEmail);

// 初始化
loadCurrentEmail();
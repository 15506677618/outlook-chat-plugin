// Sidebar script to get and display email content

const emailInfoBar = document.getElementById('email-info-bar');
const emailSubjectEl = document.getElementById('email-subject');
const emailFromEl = document.getElementById('email-from');
const emailDateEl = document.getElementById('email-date');
const chatFrame = document.getElementById('chat-frame');

let currentEmail = null;

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

      currentEmail = {
        id: message.id,
        subject: message.subject || '无主题',
        from: formatAuthor(message.author),
        date: formatDate(message.date),
        body: body || '（无内容）'
      };

      showEmailInfo(currentEmail);
      sendToChat(currentEmail);

    } catch (e) {
      console.error('Error reading email:', e);
      hideEmailInfo();
    }
  } catch (error) {
    console.error('Error getting tab:', error);
    hideEmailInfo();
  }
}

function showEmailInfo(email) {
  emailSubjectEl.textContent = email.subject;
  emailFromEl.textContent = email.from;
  emailDateEl.textContent = email.date;
  emailInfoBar.classList.add('show');
}

function hideEmailInfo() {
  emailInfoBar.classList.remove('show');
  currentEmail = null;
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

function sendToChat(email) {
  const emailData = {
    type: 'emailContent',
    subject: email.subject,
    from: email.from,
    date: email.date,
    body: email.body,
    fullContext: `【邮件内容】
主题：${email.subject}
发件人：${email.from}
日期：${email.date}

${email.body}`
  };

  // 等待 iframe 加载完成后发送数据
  if (chatFrame.contentWindow) {
    chatFrame.contentWindow.postMessage(emailData, '*');
  } else {
    chatFrame.onload = () => {
      chatFrame.contentWindow.postMessage(emailData, '*');
    };
  }
}

// 监听邮件切换
if (browser.messageDisplay && browser.messageDisplay.onMessageDisplayed) {
  browser.messageDisplay.onMessageDisplayed.addListener(loadCurrentEmail);
}

// 初始化
loadCurrentEmail();

// 监听来自聊天窗口的消息
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'getEmailContent') {
    if (currentEmail) {
      event.source.postMessage({
        type: 'emailContentResponse',
        email: currentEmail
      }, '*');
    }
  }
});

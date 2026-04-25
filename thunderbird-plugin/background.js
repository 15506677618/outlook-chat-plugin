// Background script for Thunderbird extension

let chatWindow = null;

browser.runtime.onInstalled.addListener(() => {
  console.log('Chat Helper extension installed');
});

// 点击工具栏按钮时，打开或聚焦聊天窗口
browser.messageDisplayAction.onClicked.addListener(async (tab) => {
  try {
    console.log('Chat Helper: Button clicked');
    
    // 如果窗口已存在，聚焦它
    if (chatWindow) {
      try {
        await browser.windows.update(chatWindow.id, { focused: true });
        return;
      } catch (e) {
        // 窗口可能已关闭，重新创建
        chatWindow = null;
      }
    }
    
    // 获取当前邮件信息
    let emailData = null;
    try {
      const message = await browser.messageDisplay.getDisplayedMessage(tab.id);
      if (message) {
        const fullMessage = await browser.messages.getFull(message.id);
        const body = extractEmailBody(fullMessage.parts);
        emailData = {
          subject: message.subject || '无主题',
          author: formatAuthor(message.author),
          date: formatDate(message.date),
          body: body
        };
      }
    } catch (e) {
      console.error('Chat Helper: Error getting email info:', e);
    }
    
    // 创建独立窗口
    const url = browser.runtime.getURL('chat-window.html');
    chatWindow = await browser.windows.create({
      url: url + (emailData ? '?email=' + encodeURIComponent(JSON.stringify(emailData)) : ''),
      type: 'popup',
      width: 900,
      height: 700,
      left: screen.width - 950,
      top: 50
    });
    
    console.log('Chat Helper: Window created', chatWindow.id);
  } catch (error) {
    console.error('Chat Helper: Error opening window:', error);
  }
});

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
    return new Date(date).toLocaleString('zh-CN');
  } catch {
    return date;
  }
}

// 监听窗口关闭
browser.windows.onRemoved.addListener((windowId) => {
  if (chatWindow && chatWindow.id === windowId) {
    chatWindow = null;
  }
});
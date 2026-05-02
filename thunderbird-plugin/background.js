// Background script for Thunderbird extension

let chatTabId = null;

browser.runtime.onInstalled.addListener(() => {
  console.log('AI 邮件助手已安装');
});

// 监听来自聊天窗口的消息
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message);
  
  if (message.type === 'getEmailContent') {
    // 获取当前显示的邮件
    browser.messageDisplay.getDisplayedMessage(sender.tab.id).then(message => {
      if (message) {
        getEmailConversation(message.id).then(conversation => {
          sendResponse({
            type: 'emailContent',
            subject: message.subject || '无主题',
            from: formatAuthor(message.author),
            date: formatDate(message.date),
            conversation: conversation
          });
        }).catch(error => {
          console.error('获取邮件会话失败:', error);
          sendResponse({ type: 'error', message: '获取邮件失败' });
        });
      } else {
        sendResponse({ type: 'error', message: '没有打开的邮件' });
      }
    }).catch(error => {
      console.error('获取邮件失败:', error);
      sendResponse({ type: 'error', message: error.message });
    });
    return true; // 保持消息通道开放，异步返回
  }
});

// 获取邮件内容（回复邮件中已包含原始邮件的引用）
async function getEmailConversation(messageId) {
  try {
    // 获取当前邮件的完整信息
    const message = await browser.messages.get(messageId);
    const fullMessage = await browser.messages.getFull(message.id);
    
    console.log('当前邮件:', message.subject);
    
    // 返回当前邮件内容即可（回复邮件中已包含原始邮件引用）
    const conversation = [{
      id: message.id,
      subject: message.subject,
      from: formatAuthor(message.author),
      date: formatDate(message.date),
      body: extractEmailBody(fullMessage.parts) || '（无内容）',
      isReply: message.subject.toLowerCase().startsWith('re:')
    }];
    
    return conversation;
    
  } catch (e) {
    console.error('获取邮件失败:', e);
    return [];
  }
}

// 监听工具栏图标点击，打开聊天窗口
browser.messageDisplayAction.onClicked.addListener(async (tab) => {
  console.log('图标被点击，当前标签页:', tab.id);
  
  try {
    // 使用 tabs.create 打开新标签页
    const newTab = await browser.tabs.create({
      url: browser.runtime.getURL('chat-window.html'),
      active: true
    });
    
    chatTabId = newTab.id;
    console.log('聊天窗口已打开，标签页 ID:', chatTabId);
    
    // 获取当前邮件并发送到聊天窗口
    try {
      const message = await browser.messageDisplay.getDisplayedMessage(tab.id);
      console.log('获取到邮件:', message ? message.subject : 'null');
      
      if (message) {
        // 获取邮件会话历史
        const conversation = await getEmailConversation(message.id);
        
        // 等待聊天窗口加载完成后发送邮件数据
        setTimeout(() => {
          browser.tabs.sendMessage(chatTabId, {
            type: 'emailContent',
            subject: message.subject || '无主题',
            from: formatAuthor(message.author),
            date: formatDate(message.date),
            conversation: conversation
          }).catch(err => {
            console.log('发送消息失败，等待重试:', err.message);
            // 重试一次
            setTimeout(() => {
              browser.tabs.sendMessage(chatTabId, {
                type: 'emailContent',
                subject: message.subject || '无主题',
                from: formatAuthor(message.author),
                date: formatDate(message.date),
                conversation: conversation
              }).catch(retryErr => {
                console.error('重试失败:', retryErr);
              });
            }, 1000);
          });
        }, 500);
      }
    } catch (e) {
      console.error('获取邮件失败:', e);
    }
    
  } catch (error) {
    console.error('打开聊天窗口失败:', error);
  }
});

// 监听邮件显示，更新聊天窗口
browser.messageDisplay.onMessageDisplayed.addListener(async (tab) => {
  console.log('邮件已切换:', tab.id);
  
  if (chatTabId) {
    try {
      const message = await browser.messageDisplay.getDisplayedMessage(tab.id);
      
      if (message) {
        // 获取邮件会话历史
        const conversation = await getEmailConversation(message.id);
        
        browser.tabs.sendMessage(chatTabId, {
          type: 'emailContent',
          subject: message.subject || '无主题',
          from: formatAuthor(message.author),
          date: formatDate(message.date),
          conversation: conversation
        }).catch(err => {
          console.log('聊天窗口可能未打开:', err.message);
        });
      }
    } catch (e) {
      console.error('获取邮件失败:', e);
    }
  }
});

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

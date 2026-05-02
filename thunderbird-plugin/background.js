// Background script for Thunderbird extension (DEBUG VERSION)
// 用于排查：工具栏图标/Message Display Action 不显示问题

let chatTabId = null;
const DEBUG = true;

// API 配置 - 根据环境设置
// 开发环境：http://localhost:3000
// 生产环境：https://koudai.xin
const API_BASE_URL = 'https://koudai.xin';  // 生产环境域名

// 发送配置给聊天窗口（使用非流式接口，避免 CORS 问题）
const configMessage = {
  type: 'config',
  apiUrl: API_BASE_URL + '/api/chat'  // 非流式，之前能工作的版本
};

function log(...args) {
  if (DEBUG) {
    console.log('[AI-EMAIL-DEBUG]', ...args);
  }
}

function warn(...args) {
  console.warn('[AI-EMAIL-WARN]', ...args);
}

function error(...args) {
  console.error('[AI-EMAIL-ERROR]', ...args);
}

log('background script loading...');

// ============================
// 安装事件
// ============================
browser.runtime.onInstalled.addListener((details) => {
  log('onInstalled triggered:', details);
  log('reason:', details.reason);
  log('extension id:', browser.runtime.id);
  
  // 设置图标
  browser.messageDisplayAction.setIcon({
    path: {
      16: 'icons/icon-v2-16.png',
      32: 'icons/icon-v2-32.png'
    }
  }).then(() => {
    log('icon set successfully');
  }).catch(err => {
    error('failed to set icon:', err);
  });
  
  // 注入 CSS 强制显示图标
  injectButtonStyle();
});

async function injectButtonStyle() {
  try {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.type === 'messageDisplay') {
        await browser.tabs.insertCSS(tab.id, {
          file: 'button-style.css'
        });
        log('CSS injected into tab', tab.id);
      }
    }
  } catch (error) {
    error('CSS injection failed:', error);
  }
}

browser.tabs.onCreated.addListener((tab) => {
  if (tab.type === 'messageDisplay') {
    setTimeout(() => {
      browser.tabs.insertCSS(tab.id, {
        file: 'button-style.css'
      }).then(() => {
        log('CSS injected into new tab', tab.id);
      }).catch(err => {
        error('CSS injection failed for new tab:', err);
      });
    }, 500);
  }
});

browser.runtime.onStartup.addListener(() => {
  log('onStartup triggered');
});

// ============================
// 检查 API 可用性（关键 debug）
// ============================
function checkAPIs() {
  log('checking Thunderbird APIs availability...');

  log('browser.messageDisplayAction:', typeof browser.messageDisplayAction);
  log('browser.messageDisplay:', typeof browser.messageDisplay);
  log('browser.tabs:', typeof browser.tabs);
  log('browser.runtime:', typeof browser.runtime);

  if (!browser.messageDisplayAction) {
    error('messageDisplayAction NOT AVAILABLE - 图标可能不会显示');
  } else {
    log('messageDisplayAction OK');
  }

  if (!browser.messageDisplay) {
    error('messageDisplay NOT AVAILABLE');
  } else {
    log('messageDisplay OK');
  }
}

checkAPIs();

// ============================
// 图标点击监听（核心排查点）
// ============================
if (browser.messageDisplayAction && browser.messageDisplayAction.onClicked) {
  log('registering messageDisplayAction.onClicked listener');

  browser.messageDisplayAction.onClicked.addListener(async (tab) => {
    log('ICON CLICKED EVENT TRIGGERED');
    log('tab info:', tab);

    try {
      const newTab = await browser.tabs.create({
        url: browser.runtime.getURL('chat-window.html'),
        active: true
      });

      chatTabId = newTab.id;
      log('chat window opened, tab id:', chatTabId);

      const message = await browser.messageDisplay.getDisplayedMessage(tab.id);
      log('current message from Thunderbird:', message);

      if (!message) {
        warn('no message found in current tab');
        return;
      }

      const conversation = await getEmailConversation(message.id);
      log('conversation loaded:', conversation);
      
      // 获取用户邮箱
      const userEmail = await getUserEmail();
      
      setTimeout(() => {
        log('sending message to chat window...');
        
        // 先发送配置（非流式接口）
        browser.tabs.sendMessage(chatTabId, {
          type: 'config',
          apiUrl: API_BASE_URL + '/api/chat'  // 非流式，解决 CORS 问题
        }).then(() => {
          log('config sent successfully');
        }).catch(err => {
          error('send config failed:', err);
        });
        
        // 再发送邮件内容
        browser.tabs.sendMessage(chatTabId, {
          type: 'emailContent',
          userEmail: userEmail,
          subject: message.subject || '无主题',
          from: formatAuthor(message.author),
          date: formatDate(message.date),
          conversation
        }).then(() => {
          log('message sent successfully');
        }).catch(err => {
          error('sendMessage failed:', err);
        });
        
      }, 1000);

    } catch (e) {
      error('onClicked handler error:', e);
    }
  });
} else {
  error('messageDisplayAction.onClicked NOT AVAILABLE - 图标不会响应点击');
}

// ============================
// message display listener
// ============================
if (browser.messageDisplay && browser.messageDisplay.onMessageDisplayed) {
  browser.messageDisplay.onMessageDisplayed.addListener(async (tab) => {
    log('messageDisplay.onMessageDisplayed fired:', tab);

    if (!chatTabId) {
      log('no chatTabId yet, skipping');
      return;
    }

    try {
      const message = await browser.messageDisplay.getDisplayedMessage(tab.id);
      log('updated message:', message);

      if (!message) return;

      const conversation = await getEmailConversation(message.id);
      
      // 获取用户邮箱
      const userEmail = await getUserEmail();
      
      browser.tabs.sendMessage(chatTabId, {
        type: 'emailContent',
        userEmail: userEmail,
        subject: message.subject || '无主题',
        from: formatAuthor(message.author),
        date: formatDate(message.date),
        conversation
      }).catch(err => {
        warn('chat window not ready or missing:', err.message);
      });

    } catch (e) {
      error('onMessageDisplayed error:', e);
    }
  });
} else {
  warn('messageDisplay.onMessageDisplayed not available');
}

// ============================
// message listener
// ============================
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log('runtime.onMessage received:', message);

  if (message.type === 'getEmailContent') {
    log('processing getEmailContent request');

    browser.messageDisplay.getDisplayedMessage(sender.tab.id)
      .then(msg => {
        log('getDisplayedMessage result:', msg);

        if (!msg) {
          sendResponse({ type: 'error', message: '没有打开的邮件' });
          return;
        }

      return getUserEmail().then(userEmail => {
        return getEmailConversation(msg.id).then(conversation => {
          sendResponse({
            type: 'emailContent',
            userEmail: userEmail,
            subject: msg.subject,
            from: formatAuthor(msg.author),
            date: formatDate(msg.date),
            conversation
          });
        });
      });
      })
      .catch(err => {
        error('getEmailContent error:', err);
        sendResponse({ type: 'error', message: err.message });
      });

    return true;
  }
});

// ============================
// email conversation
// ============================
async function getEmailConversation(messageId) {
  log('getEmailConversation:', messageId);

  try {
    const message = await browser.messages.get(messageId);
    const fullMessage = await browser.messages.getFull(message.id);

    log('message:', message);
    log('fullMessage loaded');

    return [{
      id: message.id,
      subject: message.subject,
      from: formatAuthor(message.author),
      date: formatDate(message.date),
      body: extractEmailBody(fullMessage.parts) || '（无内容）',
      isReply: message.subject?.toLowerCase().startsWith('re:')
    }];

  } catch (e) {
    error('getEmailConversation failed:', e);
    return [];
  }
}

// ============================
// 获取用户邮箱
// ============================
async function getUserEmail() {
  try {
    const identities = await browser.identities.list();
    if (identities && identities.length > 0) {
      // 返回第一个身份（主邮箱）
      log('user email:', identities[0].email);
      return identities[0].email;
    }
  } catch (e) {
    error('get user email failed:', e);
  }
  return null;
}

// ============================
// helpers
// ============================
function formatAuthor(author) {
  if (!author) return '未知';
  const match = author.match(/<(.+)>/);
  return match ? match[1] : author;
}

function formatDate(date) {
  if (!date) return '-';

  try {
    const d = new Date(date);
    return d.toLocaleString('zh-CN');
  } catch (e) {
    error('formatDate error:', e);
    return date;
  }
}

function extractEmailBody(parts) {
  if (!parts) {
    warn('no parts in email');
    return '';
  }

  for (const part of parts) {
    if (part.contentType === 'text/plain' && part.body) {
      return part.body.trim();
    }

    if (part.parts) {
      const result = extractEmailBody(part.parts);
      if (result) return result;
    }
  }

  return '';
}

log('background script initialized');

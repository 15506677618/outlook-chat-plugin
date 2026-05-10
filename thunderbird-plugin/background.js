// Background script for Thunderbird extension (DEBUG VERSION)
// 用于排查：工具栏图标/Message Display Action 不显示问题

let chatTabId = null;
const DEBUG = true;

// 从 manifest.json 或环境变量加载配置
// 开发环境：http://localhost:3002
// 生产环境：https://koudai.xin
async function loadConfig() {
  try {
    // 尝试从 storage 读取配置（用户可手动设置）
    const stored = await browser.storage.local.get([
      'userId', 'userName', 'apiBaseUrl', 'accessPassword', 'nodeEnv'
    ]);
    
    if (stored.apiBaseUrl) {
      log('从 storage 加载配置:', stored.nodeEnv || 'custom');
      return {
        USER_ID: stored.userId || 'demo_user',
        USER_NAME: stored.userName || '演示用户',
        API_BASE_URL: stored.apiBaseUrl,
        ACCESS_PASSWORD: stored.accessPassword || 'koudai123',
        NODE_ENV: stored.nodeEnv || 'production'
      };
    }
  } catch (e) {
    warn('无法从 storage 读取配置:', e);
  }
  
  // 默认生产环境配置
  return {
    USER_ID: 'demo_user',
    USER_NAME: '演示用户',
    API_BASE_URL: 'https://koudai.xin',
    ACCESS_PASSWORD: 'koudai123',
    NODE_ENV: 'production'
  };
}

// 全局配置
let appConfig = null;

// 初始化配置
async function initConfig() {
  appConfig = await loadConfig();
  log('配置已加载:', appConfig.NODE_ENV, appConfig.API_BASE_URL);
}

// 启动时初始化
initConfig();

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
        
        // 确保配置已加载
        if (!appConfig) {
          appConfig = {
            API_BASE_URL: 'https://koudai.xin',
            ACCESS_PASSWORD: 'koudai123'
          };
        }
        
        // 先发送配置（非流式接口）
        browser.tabs.sendMessage(chatTabId, {
          type: 'config',
          apiUrl: appConfig.API_BASE_URL + '/api/chat',
          accessPassword: appConfig.ACCESS_PASSWORD,
          nodeEnv: appConfig.NODE_ENV
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

  if (message.type === 'composeEmail') {
    log('opening compose window with content:', message);
    // 打开新建邮件窗口，支持传入主题和正文
    const options = {};
    if (message.subject) options.subject = message.subject;
    if (message.body) options.body = message.body;
    if (message.to) options.to = message.to;
    
    browser.compose.beginNew(options).then((tab) => {
      log('compose window opened:', tab);
      sendResponse({ success: true, tabId: tab.id });
    }).catch((err) => {
      error('failed to open compose window:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.type === 'getConfig') {
    log('processing getConfig request');
    
    // 使用 Promise 处理 async 配置加载
    const handleConfig = async () => {
      // 确保配置已加载
      if (!appConfig) {
        appConfig = await loadConfig();
      }
      
      sendResponse({
        type: 'config',
        apiUrl: appConfig.API_BASE_URL + '/api/chat',
        accessPassword: appConfig.ACCESS_PASSWORD,
        nodeEnv: appConfig.NODE_ENV,
        userId: appConfig.USER_ID,
        userName: appConfig.USER_NAME
      });
    };
    
    handleConfig().catch(err => {
      error('getConfig error:', err);
      sendResponse({
        type: 'config',
        apiUrl: 'https://koudai.xin/api/chat',
        accessPassword: 'koudai123',
        nodeEnv: 'production',
        userId: 'demo_user',
        userName: '演示用户'
      });
    });
    return true;
  }
  
  // 处理配置更新消息
  if (message.type === 'configUpdated') {
    log('config updated, reloading...');
    loadConfig().then(config => {
      appConfig = config;
      sendResponse({ success: true });
    }).catch(err => {
      error('configUpdated error:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

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

    // 获取邮件的 Message-ID 头（真正的唯一标识符）
    let realMessageId = fullMessage.headers['message-id']?.[0] || fullMessage.headers['Message-ID']?.[0];
    if (!realMessageId) {
      // 如果没有 Message-ID，使用 Thunderbird 内部 ID
      realMessageId = 'tb-' + message.id;
    }
    log('realMessageId:', realMessageId);

    // 提取邮件正文和附件信息
    const emailData = extractEmailBody(fullMessage.parts);
    
    // 获取内嵌图片的 base64 内容
    if (emailData.hasImages && browser.messages.listAttachments && browser.messages.getAttachmentFile) {
      log('开始获取附件内容...');
      try {
        const attachments = await browser.messages.listAttachments(message.id);
        log('找到附件数量:', attachments.length);
        
        for (const attachment of attachments) {
          // 只处理图片类型的内嵌附件
          if (attachment.contentType?.startsWith('image/')) {
            log('处理图片附件:', attachment.name, 'disposition:', attachment.disposition);
            
            try {
              // 获取附件文件
              const file = await browser.messages.getAttachmentFile(
                message.id, 
                attachment.partName
              );
              
              // 读取文件为 base64
              const base64Content = await fileToBase64(file);
              
              // 找到对应的附件对象并添加内容
              const imgAtt = emailData.attachments.find(att => 
                att.type === 'image' && 
                (att.name === attachment.name || 
                 att.name === attachment.partName ||
                 attachment.name?.includes(att.name))
              );
              
              if (imgAtt) {
                imgAtt.content = base64Content;
                imgAtt.contentId = attachment.contentId;
                log('图片内容已加载:', attachment.name, '大小:', base64Content.length);
              }
            } catch (attErr) {
              error('获取附件内容失败:', attachment.name, attErr);
            }
          }
        }
      } catch (attErr) {
        error('获取附件列表失败:', attErr);
      }
    }
    
    return [{
      id: realMessageId,
      subject: message.subject,
      from: formatAuthor(message.author),
      date: formatDate(message.date),
      body: emailData.plain || '（无内容）',
      html: emailData.html,
      hasHtml: !!emailData.html,
      attachments: emailData.attachments,
      hasImages: emailData.hasImages,
      isReply: message.subject?.toLowerCase().startsWith('re:')
    }];

  } catch (e) {
    error('getEmailConversation failed:', e);
    return [];
  }
}

// ============================
// 文件转 base64
// ============================
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // 移除 data:image/xxx;base64, 前缀
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================
// 获取用户邮箱
// ============================
async function getUserEmail() {
  try {
    // 检查 browser.identities API 是否可用
    if (!browser.identities || !browser.identities.list) {
      warn('browser.identities API not available');
      return null;
    }
    
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

function extractEmailBody(parts, preferHtml = true) {
  if (!parts) {
    warn('no parts in email');
    return { html: '', plain: '', attachments: [], hasImages: false };
  }

  let plainText = '';
  let htmlContent = '';
  let attachments = [];

  for (const part of parts) {
    // 提取 HTML 内容
    if (preferHtml && part.contentType === 'text/html' && part.body) {
      htmlContent = part.body.trim();
    }
    // 提取纯文本内容
    else if (part.contentType === 'text/plain' && part.body) {
      plainText = part.body.trim();
    }
    // 处理内嵌图片
    else if (part.contentType?.startsWith('image/')) {
      attachments.push({
        type: 'image',
        contentType: part.contentType,
        name: part.name || 'image',
        content: part.body,  // base64
        disposition: part.disposition || 'inline'
      });
    }
    // 处理附件
    else if (part.name && part.body) {
      attachments.push({
        type: 'attachment',
        contentType: part.contentType,
        name: part.name,
        size: part.size || 0
      });
    }
    // 递归处理子部分
    else if (part.parts) {
      const result = extractEmailBody(part.parts, preferHtml);
      if (result.html && !htmlContent) htmlContent = result.html;
      if (result.plain && !plainText) plainText = result.plain;
      attachments.push(...result.attachments);
    }
  }

  return {
    html: htmlContent,
    plain: plainText,
    attachments: attachments,
    hasImages: attachments.some(att => att.type === 'image' && att.disposition === 'inline')
  };
}

log('background script initialized');

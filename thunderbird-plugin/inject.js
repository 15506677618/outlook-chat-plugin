// Chat Helper - Inject into email pane

(function() {
  console.log('Chat Helper: Starting...');

  // 防止重复注入
  if (window.chatHelperInjected) {
    console.log('Chat Helper: Already injected');
    return;
  }
  window.chatHelperInjected = true;

  let chatVisible = true;
  let container = null;
  let toggleBtn = null;

  // 创建聊天容器
  function createChatContainer() {
    const el = document.createElement('div');
    el.id = 'chat-helper-container';
    el.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 400px;
      height: 100vh;
      background: #fff;
      box-shadow: -2px 0 8px rgba(0,0,0,0.1);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    el.innerHTML = `
      <div style="padding: 12px 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 14px; font-weight: 600;">🤖 AI 聊天助手</span>
        <button id="chat-helper-toggle" style="background: rgba(255,255,255,0.2); border: none; color: #fff; width: 28px; height: 28px; border-radius: 4px; cursor: pointer; font-size: 18px;">−</button>
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
        <div id="chat-helper-email-info" style="padding: 12px 15px; background: #f8f9fa; border-bottom: 1px solid #dee2e6; font-size: 12px;">
          <div style="margin: 4px 0; color: #495057;"><strong>主题:</strong> <span id="chat-helper-subject">加载中...</span></div>
          <div style="margin: 4px 0; color: #495057;"><strong>发件人:</strong> <span id="chat-helper-from">加载中...</span></div>
          <div style="margin: 4px 0; color: #495057;"><strong>日期:</strong> <span id="chat-helper-date">加载中...</span></div>
        </div>
        <iframe id="chat-helper-frame" src="https://koudai.xin/chat.html" style="flex: 1; width: 100%; border: none;"></iframe>
      </div>
    `;
    return el;
  }

  // 获取当前邮件信息
  async function getEmailInfo() {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) return null;

      const message = await browser.messageDisplay.getDisplayedMessage(tabs[0].id);
      if (!message) return null;

      const fullMessage = await browser.messages.getFull(message.id);
      const body = extractEmailBody(fullMessage.parts);

      return {
        subject: message.subject || '无主题',
        author: formatAuthor(message.author),
        date: formatDate(message.date),
        body: body
      };
    } catch (error) {
      console.error('Chat Helper: Error getting email info:', error);
      return null;
    }
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
      return new Date(date).toLocaleString('zh-CN');
    } catch {
      return date;
    }
  }

  // 更新邮件信息
  async function updateEmailInfo() {
    const emailInfo = await getEmailInfo();
    if (!emailInfo) return;

    const subjectEl = document.getElementById('chat-helper-subject');
    const fromEl = document.getElementById('chat-helper-from');
    const dateEl = document.getElementById('chat-helper-date');

    if (subjectEl) subjectEl.textContent = emailInfo.subject;
    if (fromEl) fromEl.textContent = emailInfo.author;
    if (dateEl) dateEl.textContent = emailInfo.date;

    // 发送邮件信息到聊天窗口
    const chatFrame = document.getElementById('chat-helper-frame');
    if (chatFrame) {
      const emailSummary = `邮件主题：${emailInfo.subject}\n发件人：${emailInfo.author}\n\n内容:\n${emailInfo.body}`;
      try {
        chatFrame.contentWindow.postMessage({
          type: 'emailContent',
          subject: emailInfo.subject,
          author: emailInfo.author,
          body: emailInfo.body,
          fullText: emailSummary
        }, '*');
      } catch (e) {
        console.error('Chat Helper: Failed to send to chat:', e);
      }
    }
  }

  // 切换聊天窗口显示/隐藏
  function toggleChat() {
    if (!container) return;
    
    chatVisible = !chatVisible;
    console.log('Chat Helper: Toggling chat, visible:', chatVisible);
    
    if (chatVisible) {
      container.style.transform = 'translateX(0)';
      toggleBtn.textContent = '−';
    } else {
      container.style.transform = 'translateX(100%)';
      toggleBtn.textContent = '+';
    }
  }

  // 监听 storage 变化
  browser.storage.onChanged.addListener((changes, area) => {
    console.log('Chat Helper: Storage changed:', changes, area);
    if (area === 'local' && changes.chatHelperToggle) {
      toggleChat();
    }
  });

  // 初始化 - 等待 DOM 加载完成
  async function init() {
    console.log('Chat Helper: Initializing...');
    
    // 等待页面加载
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 创建并添加聊天容器
    container = createChatContainer();
    document.body.appendChild(container);
    console.log('Chat Helper: Container added');

    // 绑定按钮
    toggleBtn = document.getElementById('chat-helper-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleChat);
    }

    // 更新邮件信息
    await updateEmailInfo();

    // 监听邮件切换
    browser.messageDisplay.onMessageDisplayed.addListener(updateEmailInfo);

    console.log('Chat Helper: Initialized successfully');
  }

  // 启动
  init();
})();
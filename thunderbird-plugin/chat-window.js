// Chat window script to receive email content and send to chat

let currentEmail = null;

// 监听来自 sidebar.js 的邮件数据
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'emailContent') {
    currentEmail = event.data;
    displayEmail(currentEmail);
    sendEmailContextToChat(currentEmail);
  }
});

function displayEmail(email) {
  const subjectEl = document.getElementById('email-subject');
  const fromEl = document.getElementById('email-from');
  const dateEl = document.getElementById('email-date');
  const bodyEl = document.getElementById('email-body');

  if (subjectEl) subjectEl.textContent = email.subject || '无主题';
  if (fromEl) fromEl.textContent = `发件人：${email.from}`;
  if (dateEl) dateEl.textContent = `日期：${email.date}`;
  if (bodyEl) bodyEl.textContent = email.body || '（无内容）';
}

function sendEmailContextToChat(email) {
  // 等待 iframe 加载完成后发送数据
  const chatFrame = document.getElementById('chat-frame');
  
  if (chatFrame && chatFrame.contentWindow) {
    // 发送邮件上下文到聊天页面
    chatFrame.contentWindow.postMessage({
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
    }, '*');
  }
}

// 页面加载时，如果有邮件数据，也发送一次
window.addEventListener('DOMContentLoaded', () => {
  if (currentEmail) {
    sendEmailContextToChat(currentEmail);
  }
});

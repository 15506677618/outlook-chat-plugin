// Chat window script

document.addEventListener('DOMContentLoaded', async () => {
  const emailAuthor = document.getElementById('email-author');
  const emailDate = document.getElementById('email-date');
  const emailContent = document.getElementById('email-content');
  const chatFrame = document.getElementById('chat-frame');

  // 从 URL 参数获取邮件信息
  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get('email');
  
  if (emailParam) {
    try {
      const emailData = JSON.parse(decodeURIComponent(emailParam));
      displayEmailInfo(emailData);
      sendToChat(emailData);
    } catch (e) {
      console.error('Chat Helper: Error parsing email data:', e);
      showEmptyState();
    }
  } else {
    showEmptyState();
  }

  function showEmptyState() {
    emailAuthor.textContent = '发件人：-';
    emailDate.textContent = '日期：-';
    emailContent.innerHTML = '<p style="color: #6c757d;">请打开一封邮件后再点击 Chat Helper 按钮</p>';
  }

  function displayEmailInfo(emailData) {
    emailAuthor.textContent = `发件人：${emailData.author}`;
    emailDate.textContent = `日期：${emailData.date}`;
    emailContent.innerHTML = `<div class="body-text">${escapeHtml(emailData.body) || '（无内容）'}</div>`;
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function sendToChat(emailData) {
    const emailSummary = `邮件主题：${emailData.subject}\n发件人：${emailData.author}\n\n内容:\n${emailData.body}`;
    
    chatFrame.onload = () => {
      try {
        chatFrame.contentWindow.postMessage({
          type: 'emailContent',
          subject: emailData.subject,
          author: emailData.author,
          body: emailData.body,
          fullText: emailSummary
        }, '*');
      } catch (e) {
        console.error('Chat Helper: Failed to send to chat:', e);
      }
    };
  }
});
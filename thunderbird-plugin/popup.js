// Popup script to get and display email content

document.addEventListener('DOMContentLoaded', async () => {
  const emailAuthor = document.getElementById('email-author');
  const emailDate = document.getElementById('email-date');
  const emailContent = document.getElementById('email-content');
  const chatFrame = document.getElementById('chat-frame');

  async function loadCurrentEmail() {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });

      if (tabs.length === 0) {
        showEmptyState();
        return;
      }

      const currentTab = tabs[0];

      try {
        const message = await browser.messageDisplay.getDisplayedMessage(currentTab.id);

        if (!message) {
          showEmptyState();
          return;
        }

        emailAuthor.textContent = `发件人: ${formatAuthor(message.author)}`;
        emailDate.textContent = `日期: ${formatDate(message.date)}`;

        const fullMessage = await browser.messages.getFull(message.id);
        const body = extractEmailBody(fullMessage.parts);

        emailContent.innerHTML = `<div class="body-text">${escapeHtml(body) || '（无内容）'}</div>`;

        sendToChat(message, body);

      } catch (e) {
        console.error('Error reading email:', e);
        showEmptyState('无法读取邮件内容');
      }
    } catch (error) {
      console.error('Error getting tab:', error);
      showEmptyState('获取邮件信息失败');
    }
  }

  function showEmptyState(msg) {
    emailAuthor.textContent = '发件人: -';
    emailDate.textContent = '日期: -';
    emailContent.innerHTML = `<p style="color: #999;">${msg || '请选择一封邮件查看内容...'}</p>`;
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

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function sendToChat(message, body) {
    const emailSummary = `邮件主题: ${message.subject || '无主题'}\n发件人: ${formatAuthor(message.author)}\n\n内容:\n${body || '（无内容）'}`;

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

  loadCurrentEmail();
});
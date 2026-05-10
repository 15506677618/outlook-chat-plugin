# 图文邮件解析改进计划

## 当前问题分析

### 现状
1. `extractEmailBody()` 函数只提取 `text/plain` 纯文本内容
2. 对于包含图片、HTML 格式的邮件，会丢失格式和图片信息
3. 邮件正文以纯文本形式显示在左侧邮件面板

### 需要支持的场景
1. **HTML 格式邮件** - 保留样式、链接、表格等
2. **包含图片的邮件** - 显示内嵌图片或提供图片链接
3. **图文混排邮件** - 正确处理文字和图片的排列
4. **多部分邮件 (multipart)** - 同时包含纯文本和 HTML 版本

## 实现方案

### 阶段 1：提取 HTML 内容

**修改 `extractEmailBody()` 函数：**
- 优先提取 `text/html` 内容
- 如果没有 HTML，再回退到 `text/plain`
- 返回内容类型标记（html 或 plain）

**代码变更位置：**
- `background.js` 第 460-478 行

### 阶段 2：安全渲染 HTML

**在 `chat-window.html` 中：**
- 使用 iframe 或 sandbox 方式渲染 HTML 内容
- 添加 CSS 重置样式，确保邮件样式不影响页面
- 处理图片加载（允许/禁止外部图片）

**安全考虑：**
- 使用 DOMPurify 清理 HTML（防止 XSS）
- 禁用 JavaScript 执行
- 可选：禁用外部图片加载（隐私保护）

### 阶段 3：图片处理

**方案 A：内嵌图片（推荐）**
- Thunderbird API 提供内嵌图片的 base64 数据
- 将 base64 图片直接嵌入 HTML 中显示

**方案 B：图片链接**
- 对于外部图片 URL，提供占位符或点击加载
- 显示图片尺寸和文件名信息

### 阶段 4：AI 对话优化

**向 AI 发送的内容：**
- 提取纯文本版本（去除 HTML 标签）用于 AI 分析
- 保留图片信息描述（如："邮件包含 3 张图片"）
- 可选：使用 OCR 提取图片中的文字

## 详细实施步骤

### 步骤 1：修改邮件提取逻辑

```javascript
// background.js - 改进 extractEmailBody 函数
function extractEmailBody(parts, preferHtml = true) {
  if (!parts) return { content: '', type: 'plain' };
  
  let plainText = '';
  let htmlContent = '';
  let attachments = [];
  
  for (const part of parts) {
    // 提取 HTML
    if (preferHtml && part.contentType === 'text/html' && part.body) {
      htmlContent = part.body.trim();
    }
    // 提取纯文本
    else if (part.contentType === 'text/plain' && part.body) {
      plainText = part.body.trim();
    }
    // 处理内嵌图片
    else if (part.contentType?.startsWith('image/')) {
      attachments.push({
        type: 'image',
        contentType: part.contentType,
        name: part.name || 'image',
        content: part.body  // base64
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
    hasImages: attachments.length > 0
  };
}
```

### 步骤 2：创建安全的 HTML 渲染组件

```javascript
// chat-window.js - 添加 HTML 渲染函数
function renderEmailBody(emailData) {
  const emailBodyEl = document.getElementById('email-body');
  if (!emailBodyEl) return;
  
  if (emailData.html) {
    // 使用 DOMPurify 清理 HTML
    const cleanHtml = DOMPurify.sanitize(emailData.html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
        'div', 'span', 'blockquote', 'pre', 'code'],
      ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'width', 'height', 'style'],
      ALLOW_DATA_ATTR: false
    });
    
    // 创建 iframe 渲染
    emailBodyEl.innerHTML = `
      <iframe sandbox="allow-same-origin" 
              style="width: 100%; height: 100%; border: none;"
              srcdoc="${escapeHtml(cleanHtml)}">
      </iframe>
    `;
  } else {
    // 纯文本渲染
    emailBodyEl.innerHTML = `<pre style="white-space: pre-wrap;">${emailData.plain}</pre>`;
  }
}
```

### 步骤 3：处理内嵌图片

```javascript
// 将内嵌图片转换为 base64 显示
function processInlineImages(html, attachments) {
  let processedHtml = html;
  
  attachments.forEach((att, index) => {
    if (att.type === 'image' && att.content) {
      // 替换 cid: 引用
      const cid = `cid:image${index}`;
      const base64Url = `data:${att.contentType};base64,${att.content}`;
      processedHtml = processedHtml.replace(new RegExp(cid, 'g'), base64Url);
    }
  });
  
  return processedHtml;
}
```

### 步骤 4：为 AI 提供结构化内容

```javascript
// 提取邮件内容给 AI 分析
function extractContentForAI(emailData) {
  // 使用纯文本版本（去除 HTML 标签）
  let textContent = emailData.plain;
  
  // 如果没有纯文本，从 HTML 提取
  if (!textContent && emailData.html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = emailData.html;
    textContent = tempDiv.textContent || tempDiv.innerText || '';
  }
  
  // 添加图片信息
  if (emailData.hasImages) {
    textContent += `\n\n[邮件包含 ${emailData.attachments.length} 张图片]`;
  }
  
  return textContent.trim();
}
```

## 文件修改清单

1. **background.js**
   - 修改 `extractEmailBody()` 函数（第 460-478 行）
   - 更新 `getEmailConversation()` 返回结构

2. **chat-window.js**
   - 添加 `renderEmailBody()` 函数
   - 添加 `extractContentForAI()` 函数
   - 修改邮件内容接收处理逻辑

3. **chat-window.html**
   - 添加 DOMPurify 库引用
   - 调整邮件内容显示区域样式

4. **styles.css**
   - 添加 HTML 邮件渲染样式
   - 添加图片显示样式

## 依赖项

- **DOMPurify** - HTML 清理库（防止 XSS）
  - 可通过 CDN: `https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.5/purify.min.js`

## 测试用例

1. 纯文本邮件 - 正常显示
2. HTML 格式邮件 - 保留样式，安全渲染
3. 包含内嵌图片的邮件 - 图片正常显示
4. 包含外部图片链接的邮件 - 可选加载或显示占位符
5. 复杂图文混排邮件 - 布局正确
6. 超大邮件 - 性能测试

## 安全考虑

1. 所有 HTML 内容必须经过 DOMPurify 清理
2. 禁用 JavaScript 执行（iframe sandbox）
3. 外部图片默认不加载（防止跟踪）
4. 链接添加 `rel="noopener noreferrer"`

## 回退方案

如果 HTML 渲染出现问题，自动回退到纯文本显示。

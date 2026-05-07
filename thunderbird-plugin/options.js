// 选项页面脚本 - 保存用户配置

// 默认配置
const DEFAULT_CONFIG = {
  userId: 'demo_user',
  userName: '演示用户',
  apiBaseUrl: 'https://koudai.xin',
  accessPassword: 'koudai123'
};

// 加载已保存的配置
async function loadSavedConfig() {
  try {
    const stored = await browser.storage.local.get([
      'userId', 
      'userName', 
      'apiBaseUrl', 
      'accessPassword'
    ]);
    
    // 填充表单
    document.getElementById('userId').value = stored.userId || DEFAULT_CONFIG.userId;
    document.getElementById('userName').value = stored.userName || DEFAULT_CONFIG.userName;
    document.getElementById('apiBaseUrl').value = stored.apiBaseUrl || DEFAULT_CONFIG.apiBaseUrl;
    document.getElementById('accessPassword').value = stored.accessPassword || DEFAULT_CONFIG.accessPassword;
    
    console.log('[Options] 配置已加载:', stored);
  } catch (error) {
    console.error('[Options] 加载配置失败:', error);
    showStatus('加载配置失败: ' + error.message, 'error');
  }
}

// 保存配置
async function saveConfig() {
  const userId = document.getElementById('userId').value.trim();
  const userName = document.getElementById('userName').value.trim();
  const apiBaseUrl = document.getElementById('apiBaseUrl').value.trim();
  const accessPassword = document.getElementById('accessPassword').value;
  
  // 验证
  if (!userId) {
    showStatus('请输入用户 ID', 'error');
    return;
  }
  if (!userName) {
    showStatus('请输入用户名称', 'error');
    return;
  }
  if (!apiBaseUrl) {
    showStatus('请输入 API 基础地址', 'error');
    return;
  }
  
  try {
    // 保存到 storage
    await browser.storage.local.set({
      userId,
      userName,
      apiBaseUrl,
      accessPassword
    });
    
    console.log('[Options] 配置已保存:', { userId, userName, apiBaseUrl });
    showStatus('设置已保存成功！', 'success');
    
    // 通知 background.js 配置已更新
    await browser.runtime.sendMessage({
      type: 'configUpdated',
      config: { userId, userName, apiBaseUrl, accessPassword }
    });
    
  } catch (error) {
    console.error('[Options] 保存配置失败:', error);
    showStatus('保存失败: ' + error.message, 'error');
  }
}

// 显示状态消息
function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = 'status ' + type;
  
  // 3秒后隐藏
  setTimeout(() => {
    statusEl.className = 'status';
  }, 3000);
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
  loadSavedConfig();
  
  // 绑定保存按钮
  document.getElementById('saveBtn').addEventListener('click', saveConfig);
});

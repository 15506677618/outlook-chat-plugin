// 配置加载器 - 从 env 文件加载配置
// Thunderbird 插件无法直接读取文件系统，所以通过 background.js 注入配置

// 默认配置（本地开发环境）
const DEFAULT_CONFIG = {
  API_BASE_URL: 'http://localhost:3002',
  ACCESS_PASSWORD: 'koudai123',
  NODE_ENV: 'development'
};

// 全局配置对象
let appConfig = { ...DEFAULT_CONFIG };

// 从 background.js 接收配置
function loadConfig(config) {
  if (config) {
    appConfig = {
      ...DEFAULT_CONFIG,
      ...config
    };
    console.log('[Config] 配置已加载:', appConfig.NODE_ENV);
  }
}

// 获取 API URL
function getApiUrl() {
  return `${appConfig.API_BASE_URL}/api/chat`;
}

// 获取访问密码
function getAccessPassword() {
  return appConfig.ACCESS_PASSWORD;
}

// 获取当前环境
function getEnvironment() {
  return appConfig.NODE_ENV || 'development';
}

// 导出配置函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadConfig, getApiUrl, getAccessPassword, getEnvironment };
}

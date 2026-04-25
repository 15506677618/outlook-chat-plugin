// Background script for Thunderbird extension

browser.runtime.onInstalled.addListener(() => {
  console.log('AI 邮件助手已安装');
});

// 监听邮件显示，自动加载侧边栏
browser.messageDisplay.onMessageDisplayed.addListener(async (tab) => {
  try {
    console.log('邮件已显示:', tab.id);
  } catch (error) {
    console.error('错误:', error);
  }
});

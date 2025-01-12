// background.js - 只负责注入和执行用户脚本
async function executeScriptInMainWorld(tabId, scriptContent) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",  // 指定在页面主世界运行
        func: (code) => {
          // 使用立即执行函数包装脚本内容
          (function() {
            eval(code);
          })();
        },
        args: [scriptContent],
      });
      console.log("[Background] Script executed (in main world) successfully.");
    } catch (error) {
      console.error("[Background] Script execution error:", error);
      throw error; // 向上传递错误
    }
  }
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === "executeScript") {
      handleExecuteScript(request, sender, sendResponse);
      return true;
    } else if (request.type === 'updateParseResult') {
      // 转发解析结果给所有popup窗口
      forwardToAllPopups(request);
      return true;
    }
  });
  
  // 处理脚本执行
  async function handleExecuteScript(request, sender, sendResponse) {
    try {
      const { scriptName, tabId } = request;
      console.log("[Background] Executing script:", scriptName);

      const data = await chrome.storage.local.get(scriptName);
      const scriptContent = data[scriptName];

      if (scriptContent) {
        await executeScriptInMainWorld(tabId, scriptContent);
        sendResponse({ status: "ok" });
      } else {
        throw new Error(`Script '${scriptName}' not found in storage.`);
      }
    } catch (error) {
      console.error("[Background] Error:", error);
      sendResponse({ status: "error", message: error.message });
    }
  }

  // 转发消息给所有popup窗口
  async function forwardToAllPopups(message) {
    try {
      // 获取所有popup类型的窗口
      const windows = await chrome.windows.getAll({ populate: true });
      const popupTabs = [];
      
      // 收集所有popup窗口中的标签页
      windows.forEach(window => {
        if (window.type === 'popup') {
          window.tabs.forEach(tab => {
            if (tab.url.includes('popup.html')) {
              popupTabs.push(tab);
            }
          });
        }
      });

      // 向所有popup标签发送消息
      popupTabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, message).catch(err => {
          console.warn(`Failed to send message to popup tab ${tab.id}:`, err);
        });
      });
    } catch (error) {
      console.error('[Background] Error forwarding message:', error);
    }
  }
  
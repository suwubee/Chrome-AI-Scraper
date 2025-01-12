// contentScript.js
console.log("[ContentScript] Loaded.");

// 监听来自网页的消息
window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  
  switch(event.data.type) {
    case 'updateStatus':
      chrome.runtime.sendMessage({
        type: 'updateStatus',
        data: event.data.data
      });
      break;
      
    case 'addLog':
      chrome.runtime.sendMessage({
        type: 'addLog',
        data: event.data.data
      });
      break;
      
    case 'updateParseResult':
      chrome.runtime.sendMessage({
        type: 'updateParseResult',
        data: event.data.data,
        error: event.data.error
      });
      break;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === "collectData") {
    const articles = Array.from(document.querySelectorAll("article"));
    const data = articles.map(a => ({
      title: a.querySelector("h1")?.innerText,
      content: a.querySelector("p")?.innerText,
    }));
    console.log("[ContentScript] Collected data:", data);

    // 回传或发给后台
    chrome.runtime.sendMessage({ command: "dataCollected", payload: data });
    sendResponse({ status: "ok" });
  }
  return true;
});

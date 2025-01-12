// popup.js

// 加载已保存的脚本列表
function loadScriptList() {
  chrome.storage.local.get(null, (data) => {
    const selector = document.getElementById('script-selector');
    const scripts = Object.keys(data).filter(key => key !== 'lastSelectedScript');
    
    // 清空现有选项
    selector.innerHTML = '<option value="">选择要执行的脚本...</option>';
    
    // 添加脚本选项
    scripts.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      selector.appendChild(option);
    });

    // 加载上次选择的脚本
    loadLastSelectedScript();
  });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadScriptList();
  loadLastResult();
  
  // 添加来自 content script 的消息监听
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'updateParseResult') {
      // 显示解析结果
      if (message.error) {
        displayResult(`解析错误: ${message.error}`);
      } else {
        displayResult(message.data);
      }
    }
  });

  // 添加新窗口打开按钮事件
  document.getElementById('btn-new-window').addEventListener('click', () => {
    chrome.windows.create({
      url: chrome.runtime.getURL("popup/popup.html"),
      type: "popup",
      width: 800,
      height: 600
    });
  });

  // 添加复制按钮事件
  const copyButton = document.getElementById('btn-copy');
  copyButton.addEventListener('click', async () => {
    const resultContent = document.getElementById('result-content');
    const text = resultContent.textContent;
    
    try {
      await navigator.clipboard.writeText(text);
      
      // 更新按钮状态
      copyButton.classList.add('copied');
      const copyText = copyButton.querySelector('.copy-text');
      copyText.textContent = '已复制!';
      
      // 2秒后恢复按钮状态
      setTimeout(() => {
        copyButton.classList.remove('copied');
        copyText.textContent = '复制结果';
      }, 2000);
      
    } catch (err) {
      console.error('复制失败:', err);
      alert('复制失败，请手动复制');
    }
  });
});

// 脚本选择事件
document.getElementById('script-selector').addEventListener('change', (e) => {
  const scriptName = e.target.value;
  document.getElementById('btn-execute').disabled = !scriptName;
  if (scriptName) {
    saveSelectedScript(scriptName);
  }
});

// 添加一个函数来获取上一个活动的标签页
async function getSourceTab() {
  // 获取当前窗口
  const currentWindow = await chrome.windows.getCurrent();
  
  // 如果是popup窗口,则查找上一个活动的标签页
  if (currentWindow.type === 'popup') {
    // 获取所有窗口
    const windows = await chrome.windows.getAll({ populate: true });
    // 查找非popup的窗口中的活动标签页
    for (const window of windows) {
      if (window.type === 'normal') {
        const activeTabs = window.tabs.filter(tab => {
          // 排除扩展页面
          return tab.active && 
                 !tab.url.startsWith('chrome://') && 
                 !tab.url.startsWith('chrome-extension://');
        });
        if (activeTabs.length > 0) {
          return activeTabs[0];
        }
      }
    }
    
    // 如果没有找到活动标签，尝试获取第一个普通网页标签
    for (const window of windows) {
      if (window.type === 'normal') {
        const normalTabs = window.tabs.filter(tab => 
          !tab.url.startsWith('chrome://') && 
          !tab.url.startsWith('chrome-extension://')
        );
        if (normalTabs.length > 0) {
          return normalTabs[0];
        }
      }
    }
  } else {
    // 如果不是popup窗口,则获取当前活动标签页
    const [tab] = await chrome.tabs.query({ 
      active: true, 
      currentWindow: true,
      url: ['http://*/*', 'https://*/*'] // 只匹配普通网页
    });
    return tab;
  }
  return null;
}

// 修改执行按钮事件处理
document.getElementById('btn-execute').addEventListener('click', async () => {
  const scriptName = document.getElementById('script-selector').value;
  if (!scriptName) return;

  // 清空所有之前的数据
  chrome.storage.local.remove(['lastResultData', 'lastStatus', 'lastCapturedCount', 'lastLogs']);
  
  // 重置显示
  displayResult('执行中...');
  document.getElementById('current-status').textContent = '执行中...';
  document.getElementById('captured-count').textContent = '0';
  document.getElementById('logs').innerHTML = '';

  const tab = await getSourceTab();
  if (!tab) {
    displayResult('无法获取目标标签页。请确保有打开的网页标签。');
    return;
  }

  // 显示当前选中的目标页面
  displayResult(`正在对页面执行脚本: ${tab.url}`);

  chrome.runtime.sendMessage({
    command: 'executeScript',
    tabId: tab.id,
    scriptName
  }, (response) => {
    if (chrome.runtime.lastError) {
      displayResult(`错误: ${chrome.runtime.lastError.message}`);
      return;
    }

    if (response.status === 'ok') {
      displayResult(`脚本执行成功,等待结果...\n目标页面: ${tab.url}`);
    } else {
      displayResult(`错误: ${response.message}`);
    }
  });
});

// 显示解析结果
function displayParseResult(result) {
  if (result.error) {
    // 显示错误信息
    displayResult(`解析错误: ${result.error}`);
    // 添加到日志
    updateUI({
      status: '解析失败',
      logs: [`错误: ${result.error}`]
    });
  } else {
    // 显示解析结果
    displayResult(result.data);
    // 添加到日志
    updateUI({
      status: '解析完成',
      logs: ['脚本执行成功', '数据解析完成']
    });
  }
}

// 显示日志
function updateUI(data) {
  const { status, logs } = data;
  
  document.getElementById('current-status').textContent = status;
  
  const logsContainer = document.getElementById('logs');
  if (logs && logs.length > 0) {
    logsContainer.innerHTML = logs.map(log => 
      `<div class="log-item">${log}</div>`
    ).join('');
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }
}

// 添加脚本选择的持久化
function saveSelectedScript(scriptName) {
  chrome.storage.local.set({ 'lastSelectedScript': scriptName });
}

function loadLastSelectedScript() {
  chrome.storage.local.get('lastSelectedScript', (data) => {
    const lastScript = data.lastSelectedScript;
    if (lastScript) {
      const selector = document.getElementById('script-selector');
      selector.value = lastScript;
      document.getElementById('btn-execute').disabled = false;
    }
  });
}

// 添加消息监听
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'log') {
    console.log('[Popup]', message.content);
    // 更新UI显示日志
    const logsDiv = document.getElementById('logs');
    if (logsDiv) {
      const logEntry = document.createElement('div');
      logEntry.textContent = message.content;
      logsDiv.appendChild(logEntry);
    }
  }
});

// 显示解析结果
function displayResult(data) {
  const resultContent = document.getElementById('result-content');
  if (!resultContent) return;

  // 保存数据到 storage
  chrome.storage.local.set({ 'lastResultData': data });

  if (typeof data === 'object') {
    // 如果包含 AI 分析结果
    if (data.aiAnalysis) {
      // Markdown 内容
      resultContent.innerHTML = marked.parse(data.aiAnalysis);
      resultContent.className = 'markdown-body';
    } else {
      // JSON 内容
      resultContent.className = 'json-content';
      resultContent.innerHTML = formatJSON(data);
    }
  } else {
    // 普通文本
    resultContent.className = 'result-content';
    resultContent.textContent = data;
  }
}

// 添加 JSON 格式化函数
function formatJSON(obj) {
  return JSON.stringify(obj, null, 2)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    })
    .replace(/\n/g, '<br>')
    .replace(/\s{2}/g, '&nbsp;&nbsp;');
}

// 修改 updateStatus 函数
function updateStatus(status) {
  const statusElement = document.getElementById('current-status');
  const countElement = document.getElementById('captured-count');
  
  if (statusElement && status.current) {
    statusElement.textContent = status.current;
    // 保存状态
    chrome.storage.local.set({ 'lastStatus': status.current });
  }
  
  if (countElement && status.captured) {
    countElement.textContent = status.captured;
    // 保存采集数量
    chrome.storage.local.set({ 'lastCapturedCount': status.captured });
  }
}

// 修改 addLog 函数
function addLog(message) {
  const logsDiv = document.getElementById('logs');
  if (logsDiv) {
    const logEntry = document.createElement('div');
    logEntry.className = 'log-item';
    logEntry.textContent = message;
    logsDiv.appendChild(logEntry);
    
    // 保存日志
    chrome.storage.local.get('lastLogs', (data) => {
      const logs = data.lastLogs || [];
      logs.push(message);
      chrome.storage.local.set({ 'lastLogs': logs });
    });
    
    // 自动滚动到底部
    logsDiv.scrollTop = logsDiv.scrollHeight;
  }
}

// 在现有的消息监听器中添加新的消息类型处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'updateParseResult') {
    // 保持现有的解析结果处理逻辑
    if (message.error) {
      displayResult(`解析错误: ${message.error}`);
    } else {
      displayResult(message.data);
    }
  } 
  // 添加新的消息类型处理
  else if (message.type === 'updateStatus') {
    updateStatus(message.data);
  }
  else if (message.type === 'addLog') {
    addLog(message.data);
  }
});

// 修改 loadLastResult 函数，加载所有缓存数据
function loadLastResult() {
  // 加载结果数据
  chrome.storage.local.get(['lastResultData', 'lastStatus', 'lastCapturedCount', 'lastLogs'], (data) => {
    // 恢复结果内容
    if (data.lastResultData) {
      displayResult(data.lastResultData);
    }
    
    // 恢复状态
    if (data.lastStatus) {
      document.getElementById('current-status').textContent = data.lastStatus;
    }
    
    // 恢复采集数量
    if (data.lastCapturedCount) {
      document.getElementById('captured-count').textContent = data.lastCapturedCount;
    }
    
    // 恢复日志
    if (data.lastLogs && data.lastLogs.length > 0) {
      const logsDiv = document.getElementById('logs');
      logsDiv.innerHTML = data.lastLogs.map(log => 
        `<div class="log-item">${log}</div>`
      ).join('');
    }
  });
}

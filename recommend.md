# AI 生成自动化脚本的提示词推荐

为更好地利用 AI（如 ChatGPT）生成**无需输出到控制台**、而是通过 **`window.postMessage`** 将日志输出至插件界面的自动化脚本，以下是一些推荐的提示词（Prompts）。在这份文档里：

1. 我们将「**主函数 (main)**」的结构与「**日志传输**」放在**首要位置**。  
2. 所有示例脚本**不再**使用 `console.log`，而是用 `window.postMessage({ type: 'addLog', data: '...' })` 来记录脚本执行过程。

---

## 目录

1. [为什么要定义主函数 (main)](#为什么要定义主函数-main)  
2. [日志输出规范（通过 window.postMessage）](#日志输出规范通过-windowpostmessage)  
3. [基础操作 Prompt](#基础操作-prompt)  
   - [点击按钮](#点击按钮)  
   - [填写表单](#填写表单)  
   - [滚动页面](#滚动页面)  
4. [网络请求处理 Prompt](#网络请求处理-prompt)  
   - [覆盖 fetch](#覆盖-fetch)  
   - [监听 XMLHttpRequest](#监听-xmlhttprequest)  
5. [数据抓取与处理 Prompt](#数据抓取与处理-prompt)  
   - [提取页面元素](#提取页面元素)  
   - [导出数据](#导出数据)  
6. [Manifest V3 相关 Prompt](#manifest-v3-相关-prompt)  
   - [注入脚本](#注入脚本)  
   - [权限配置](#权限配置)  
7. [高级自动化与 AI 集成 Prompt](#高级自动化与-ai-集成-prompt)  
8. [综合示例 Prompt](#综合示例-prompt)  
9. [最佳实践与常见问题](#最佳实践与常见问题)  
10. [HTML 清理与结构化 Prompt](#html-清理与结构化-prompt)  

---

## 为什么要定义主函数 (main)

在 **Chrome 扩展脚本（尤其是注入脚本）** 场景下，如果没有主函数，脚本往往零散地执行、且难以管理。定义一个 `main()` 函数并用 **IIFE**（自执行函数）或 `(async function() {...})();` 包裹，**有以下好处**：

1. **统一入口**：当脚本被注入时，无论脚本里有多少辅助函数，最终都从 `main()` 开始执行，易于排查、维护。  
2. **错误捕捉**：`try/catch` 写在 `main` 里，可保证脚本出错时能集中处理，并**发送错误日志**给插件 UI。  
3. **异步逻辑**：使用 `async/await`，在 `main()` 里更直观地实现「等待 X 秒、发起请求、再做处理」等操作。

**推荐写法**：

```js
(async function main() {
  try {
    // 1. 输出「脚本开始」的日志
    window.postMessage({
      type: 'addLog',
      data: '[ScriptName] 脚本开始执行...'
    }, '*');

    // 2. 在此处理你的逻辑...

    // 3. 执行完成或返回数据
    window.postMessage({
      type: 'updateParseResult',
      data: {
        message: '脚本已完成全部任务!'
      }
    }, '*');
  } catch (error) {
    // 4. 错误处理
    window.postMessage({
      type: 'updateParseResult',
      error: `脚本出现异常: ${error.message}`
    }, '*');
  }
})();
```

---

## 日志输出规范（通过 window.postMessage）

因为**不希望输出到控制台**，在此推荐**统一使用** `window.postMessage` 来把日志发送到**插件端**（例如 **Popup**）。  
- `type: 'addLog'`：添加一条日志。  
- `type: 'updateStatus'`：更新脚本执行状态（如「准备中」「执行中」「已完成」等）。  
- `type: 'updateParseResult'`：脚本最终输出的结果（或错误）。

**示例**：在脚本执行关键步骤时：

```js
window.postMessage({
  type: 'addLog',
  data: '[ScriptName] 正在查找按钮...'
}, '*');

// ...
window.postMessage({
  type: 'addLog',
  data: '[ScriptName] 找到按钮，准备点击'
}, '*');

// ...
window.postMessage({
  type: 'updateStatus',
  data: { status: '完成点击操作', captured: 1 }
}, '*');

// ...
window.postMessage({
  type: 'updateParseResult',
  data: { msg: '点击完毕，脚本结束' }
}, '*');
```

这样，插件端（例如 `contentScript.js` → `popup.js`）就能监听消息并显示在 UI 日志区域，**无需 console.log**。

---

## 基础操作 Prompt

以下示例请求 AI 生成脚本时，要**特别指明**：**请将所有日志通过 `window.postMessage` 输出**，**不要使用 console.log**。

### 点击按钮

```
请帮我生成一段 JavaScript 脚本，用于在当前网页中通过 XPath 选择器找到一个名为 "Load More" 的按钮，并模拟点击。脚本要求定义一个 (async function main(){}) 函数，过程中所有日志都用 window.postMessage({type:'addLog'}) 方式输出，并在脚本结束时发送一个 updateParseResult。
```

**预期 AI 输出**（核心片段）：

```js
(async function main() {
  try {
    window.postMessage({
      type: 'addLog',
      data: '[LoadMoreScript] 开始执行...'
    }, '*');

    const xpath = '//button[text()="Load More"]';
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    const button = result.singleNodeValue;

    if (!button) {
      window.postMessage({
        type: 'addLog',
        data: '[LoadMoreScript] 未找到按钮，脚本结束'
      }, '*');
      window.postMessage({
        type: 'updateParseResult',
        data: { message: '未找到Load More按钮' }
      }, '*');
      return;
    }

    // 模拟点击
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    window.postMessage({
      type: 'addLog',
      data: '[LoadMoreScript] 已点击按钮，等待页面加载...'
    }, '*');

    // 略：可加个等待
    // ...

    window.postMessage({
      type: 'updateParseResult',
      data: { message: '点击Load More完成' }
    }, '*');

  } catch (error) {
    window.postMessage({
      type: 'updateParseResult',
      error: '[LoadMoreScript] 出现错误: ' + error.message
    }, '*');
  }
})();
```

### 填写表单

```
请生成一段 JavaScript 脚本，用于在当前网页中自动填写一个登录表单。要求：
1. 定义 (async function main(){}) 自执行。
2. 全部日志通过 window.postMessage(type:'addLog') 输出。
3. 如果找不到输入框或按钮，则通过 updateParseResult 返回错误信息。
```

### 滚动页面

```
请编写一段 JS 脚本，用于自动滚动到页面底部，并等待 3 秒。禁止使用 console.log，统一用 window.postMessage({'type':'addLog'}) 输出日志。
```

---

## 网络请求处理 Prompt

### 覆盖 fetch

```
请生成一段脚本，覆盖 window.fetch 拦截所有 "https://api.example.com/" 的请求，在接收到响应后，通过 window.postMessage(type:'addLog') 输出拦截到的数据，最后在脚本结束时发送 updateParseResult。
```

### 监听 XMLHttpRequest

```
请生成一段脚本，监听所有发送到 "https://api.example.com/" 的 XMLHttpRequest 请求，并在 readyState===4 时，用 window.postMessage(type:'addLog') 打印响应内容。需要在 (async function main(){}) 中执行初始化。
```

---

## 数据抓取与处理 Prompt

### 提取页面元素

```
请生成一段自动化脚本 (async function main(){})，提取当前页面中 class="provider-item" 的元素信息（id、name、url），并用 window.postMessage 记录每个元素的抓取日志，最后通过 updateParseResult 返回完整数组。
```

### 导出数据

```
请编写脚本，将一组对象转换为 CSV，并以 Blob 形式触发下载。日志与最终状态都需用 window.postMessage(type:'addLog' or 'updateParseResult') 输出，禁止 console.log。
```

---

## Manifest V3 相关 Prompt

### 注入脚本

```
在 Chrome MV3 中，如何用 chrome.scripting.executeScript 注入一个自带主函数 (main) 并统一用 postMessage 发送日志的脚本？请给出 background.js 的简化示例。脚本执行成功后，也要通过 window.postMessage 发送“执行完成”。
```

### 权限配置

```
如何配置 manifest.json 以允许我的脚本访问 https://api.example.com/ 并使用 activeTab 权限？请给出最简配置示例。
```

---

## 高级自动化与 AI 集成 Prompt

```
请基于 "AiProductParser" 思路生成脚本，要求：
1. 自带 main() 函数，无 console.log，使用 postMessage(type:'addLog').
2. 先对页面HTML做简单清理，然后调用一个 AI 接口 (https://chatapi.example.com) 分析，最后通过 updateParseResult 返回 AI 结果。
3. 出错时用 updateParseResult 返回错误说明。
```

---

## 综合示例 Prompt

```
请生成一个综合脚本：
1. 点击 "Load More" 按钮，等待3秒；
2. 滚动到底部，等待2秒；
3. 提取页面中的数据，并在提取过程的每一步用 window.postMessage(type:'addLog') 输出日志；
4. 若发生错误用 updateParseResult 返回错误，否则在结束时返回提取到的数据。
5. 主函数应为 (async function main(){ ... })，不得使用 console.log。
```

---

## 最佳实践与常见问题

1. **优先使用 updateParseResult 返回最终结果**  
   - 与 `type: 'addLog'` 不同，`type: 'updateParseResult'` 通常在脚本完整执行或发生错误时调用一次，表明脚本已完成主要逻辑。  
   - 如果需要多次分段提交，可根据需求多次发送 `updateParseResult`，或使用额外的消息类型。

2. **日志等级**  
   - 如果脚本特别复杂，可以自行在 `data` 中加上类似 `level: 'info' | 'warning' | 'error'` 来标识日志级别。  
   - 插件端 UI 可以据此用不同颜色显示。

3. **等待页面异步加载**  
   - 很多脚本需要等待页面刷新或异步加载，最好结合 `async/await` 或回调判断。有时可用 `MutationObserver` 监听 DOM 变化，而不是仅用 `setTimeout`。

4. **确保脚本的 try/catch**  
   - 无论是数据处理还是网络请求，都可能报错。捕捉后用 `updateParseResult` 发回错误，避免脚本无声中断。

5. **不使用 console.log**  
   - 在此框架下，所有日志都通过 postMessage。若仍想在调试时用 console.log，可在开发阶段使用，正式发布时去掉或封装成 postMessage 方式，避免与框架日志混乱。

---

## HTML 清理与结构化 Prompt

```
请生成一个 "HtmlCleaner" 类型的脚本，要求：
1. (async function main(){}) 结构；
2. 提取页面 title 和 meta，并移除 script/style 等标签；
3. 所有日志用 window.postMessage(type:'addLog');
4. 最终用 updateParseResult 返回清理后的结构和统计信息。
```

**预期 AI 输出**的核心应类似：

```js
(async function main() {
  try {
    window.postMessage({
      type: 'addLog',
      data: '[HtmlCleaner] 脚本开始执行'
    }, '*');

    // 1. 获取HTML
    const rawHTML = document.documentElement.outerHTML;

    // 2. 解析 & 清理
    // (略)

    // 3. 发送结果
    window.postMessage({
      type: 'updateParseResult',
      data: {
        message: 'HtmlCleaner 已完成',
        cleanedData: {
          // ...
        }
      }
    }, '*');
  } catch (error) {
    window.postMessage({
      type: 'updateParseResult',
      error: `[HtmlCleaner] 出错: ${error.message}`
    }, '*');
  }
})();
```
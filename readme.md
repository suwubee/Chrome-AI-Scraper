# Chrome 爬虫通用框架 (Manifest V3)

这是一款基于 **Chrome Manifest V3** 的通用爬虫框架型插件，提供脚本管理、脚本执行、页面抓取、网络请求监听等功能。通过可视化界面（Options 页面）管理用户脚本，再在 Popup 页面一键执行脚本，极大地简化了针对不同网站的爬虫开发流程。

## 目录

1. [背景与目标](#背景与目标)
2. [核心功能](#核心功能)
3. [目录结构说明](#目录结构说明)
4. [安装与运行](#安装与运行)
5. [使用方法](#使用方法)
   1. [编辑/导入脚本 (Options)](#编辑导入脚本-options)
   2. [执行脚本 (Popup)](#执行脚本-popup)
   3. [查看执行结果](#查看执行结果)
6. [三步采集逻辑示例](#三步采集逻辑示例)
7. [关键文件说明](#关键文件说明)
   1. [manifest.json](#manifestjson)
   2. [background.js](#backgroundjs)
   3. [contentScript.js](#contentscriptjs)
   4. [popup/](#popup)
   5. [options/](#options)
8. [常见问题与解答](#常见问题与解答)
9. [后续扩展](#后续扩展)
10. [License](#license)

---

## 背景与目标

在某些场景下，需要对目标网站进行数据采集（如自动点击加载更多、滚动翻页、监听网络请求、解析响应或页面元素等）。本项目的目标是提供一个**通用爬虫框架**：

- 开发者/用户只需在插件内编写（或导入）自定义脚本，即可对任意目标页面执行复杂的爬虫逻辑。
- 插件将脚本持久化存储，支持跨会话、跨重启使用。
- 提供**三步采集**（抓取页面 / 模拟触发 / 数据导出）的参考示例，实际业务可灵活扩展。

本插件基于 **Chrome Manifest V3**，符合最新的 Chrome 扩展规范。

---

## 核心功能

1. **可视化脚本管理**：在插件的 Options 页面中添加、编辑、加载自定义脚本，并持久化到 `chrome.storage.local`。
2. **脚本执行**：在 Popup 界面一键执行指定脚本；插件会在当前活跃页面注入并运行这些脚本。
3. **网络请求监听**：通过覆盖 `fetch` 方法，拦截指定网络请求，提取响应数据。
4. **页面内容采集**：脚本可通过 DOM API、XPath 等方式抓取页面元素，或模拟点击按钮、滚动页面等操作。
5. **数据导出**：将收集到的数据整理成 CSV 文件，并自动触发下载。

---

## 目录结构说明

```
my-scraper-extension/
├── manifest.json          // 插件核心配置 (MV3)
├── background.js          // Service Worker, 负责与脚本/页面通信 & 持久化
├── contentScript.js       // 通用内容脚本，可对页面进行 DOM 操作或监听
├── popup/
│   ├── popup.html         // 弹窗 UI (执行脚本)
│   └── popup.js
├── options/
│   ├── options.html       // 选项界面 (管理脚本)
│   └── options.js
└── README.md              // 项目说明文档
└── recommend.md // AI 生成自动化脚本的提示词推荐

```

**说明**：

- `scripts/` 目录可选，若你想内置一些默认脚本文件，可以放在此处并声明为 `web_accessible_resources` 供注入使用。
- `background.js` 不再是长驻后台页面，而是一个 **Service Worker**；必须在 `manifest.json` 的 `background.service_worker` 中指定。

---

## 安装与运行

1. **下载/克隆本仓库**，或自行复制本项目所有文件到一个文件夹（例如 `my-scraper-extension`）。
2. 在 Chrome 浏览器输入 `chrome://extensions/`，打开“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择 `my-scraper-extension` 文件夹。
4. 完成后，即可在浏览器右上角看到该插件图标。

> **注意**：如遇到 `webRequestBlocking` 相关报错，请确保 `manifest.json` 中未使用该权限。

---

## 使用方法

### 编辑/导入脚本 (Options)

1. 打开 `chrome://extensions/`，或在插件的管理页面中点击 “扩展选项 (Options)”。  
2. 进入插件的 Options 页面 (`options/options.html`)：
   - 在 **Script Name** 输入框填写脚本名称（例如 `demoScript`）。
   - 在 **Script Content** 文本域里粘贴/编写你的爬虫逻辑。
   - 点击 **Save Script**，此时脚本内容会被保存到插件的本地存储 (`chrome.storage.local`)。
   - 若需要再读取已保存的脚本内容，点击 **Load Script**。

### 执行脚本 (Popup)

1. 打开需要爬取的页面（如目标网站）。
2. 点击浏览器右上角的插件图标，弹出 `popup.html`。
3. 在弹窗界面中选择你要执行的脚本（如 `demoScript`），然后点击 **执行脚本** 按钮。
4. 脚本注入后会自动运行，可能在控制台输出日志，也会自动下载 CSV 文件。

### 查看执行结果

- **网页端控制台**：脚本中的 `console.log` 会在目标网页的 DevTools → Console 中查看执行过程。
- **Popup UI**：若脚本使用 `chrome.runtime.sendMessage`，Popup 页面可以实时显示执行日志和状态。

---

## 三步采集逻辑示例

一个典型的爬虫脚本会包含以下三步：

1. **抓取页面元素或监听网络请求**
   - 例如，搜索指定的 `article`、`div`、或 `.className`，提取文本、链接、图片等。
   - 或监听指定域名的网络请求，进行调试或统计。

2. **触发动作**
   - 模拟点击“Load More”按钮、滚动至页面底部、轮询翻页等。

3. **数据导出**
   - 采集到的数据通过 `chrome.runtime.sendMessage` 发往后台，并由后台脚本打包生成 CSV 文件或上传到服务器。


示例脚本可能是这样（用户在 Options 中填写）：

```js
function captureData() {
  const items = document.querySelectorAll(".some-item-class");
  const result = [];
  items.forEach(el => {
    result.push({
      text: el.innerText,
      link: el.querySelector("a")?.href
    });
  });
  return result;
}

function autoClickLoadMore() {
  const btn = document.querySelector("button");
  if (btn && btn.innerText.includes("Load More")) {
    btn.click();
    console.log("Clicked Load More");
  }
}

function exportData(data) {
  chrome.runtime.sendMessage({
    command: "exportData",
    payload: data
  }, (res) => {
    if (res.status === "ok") {
      const a = document.createElement("a");
      a.href = res.downloadUrl;
      a.download = "scraped_data.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  });
}

(function main() {
  console.log("Script running...");
  autoClickLoadMore();
  setTimeout(() => {
    const data = captureData();
    exportData(data);
  }, 2000);
})();
```

---

## 关键文件说明

### manifest.json

- **`manifest_version`: 3**  
- **`permissions`:** 使用 `storage`、`webRequest`、`activeTab`、`tabs` 等  
- **`host_permissions`:** 若爬取所有网站可使用 `"<all_urls>"`  
- **`background`:** 指定 `service_worker` 为 `background.js`  
- **`options_ui`:** 指定 `options/options.html` 作为脚本管理界面  
- **`web_accessible_resources`:** 声明可被注入的脚本资源  

### background.js

- 作为 **Service Worker**，负责：  
  - 监听来自 Options / Popup 的消息  
  - 使用 `chrome.storage.local` 持久化脚本  
  - 通过 `executeScript` 将脚本注入目标页面  
  - 监听网络请求（如 `onBeforeRequest`）进行日志或统计  
  - 提供数据导出功能  
- 确保 `return true;` 用于异步响应，以避免消息丢失

### contentScript.js

- 通用内容脚本，会在匹配的页面上注入，做 DOM 操作或监听需求  
- 如果需要与后台或自定义脚本通信，可通过 `chrome.runtime.sendMessage` / `onMessage.addListener` 实现  
- 示例中仅展示了一个 `collectData` 的逻辑

### popup/

- `popup.html` + `popup.js`  
- 在浏览器插件图标点击时弹出  
- 提供一键执行脚本的按钮，调用后台 `executeScript` 命令

### options/

- `options.html` + `options.js`  
- 提供脚本的**增删改查**界面（示例中只做了“保存脚本”和“加载脚本”）  
- 将脚本名称与内容保存到 `chrome.storage.local`，或从中读取  
- 可以针对不同脚本名称进行管理

---

## 常见问题与解答

1. **Q**: 为何会出现 `webRequestBlocking` requires manifest_version of 2 or lower 报错？  
   **A**: Manifest V3 不再支持 `webRequestBlocking`，必须改用 `webRequest`（仅监听）或 `declarativeNetRequest`（可修改/阻断）。

2. **Q**: 为什么保存了脚本后，刷新仍丢失？  
   **A**: Manifest V3 的背景脚本是 Service Worker，不常驻，保存在全局变量会被回收。必须使用 `chrome.storage` 或其他持久化方案。

3. **Q**: 出现 `Unchecked runtime.lastError: The message port closed...` 提示？  
   **A**: 在发送消息后，如果 Popup 或 Options 页面被立刻关闭，就会触发此警告。可在回调中检查 `chrome.runtime.lastError` 并做提示，无影响功能的正常运作。

4. **Q**: 怎么执行多个脚本或管理脚本列表？  
   **A**: 可以在 Options 中自行扩展脚本列表管理；或在 Popup 中增加脚本名称选择器。核心思路相同，仍使用 `chrome.storage` 和 `executeScript`。

---

## 后续扩展

1. **脚本列表管理**：增删改查多个脚本，提供脚本选择器。  
2. **去重翻页**：在脚本内加入“滚动到页面底部并等待加载”或“分页”逻辑。  
3. **高级请求拦截**：使用 `declarativeNetRequest` 替换或增强对请求/响应的修改。  
4. **数据输出格式**：支持 CSV、Excel、数据库对接等。  
5. **权限最小化**：如果只爬特定站点，可在 `host_permissions` 中限定域名，减少审阅阻力。

---

## License

本项目示例默认采用 **MIT License**。如需在商业项目中使用或二次开发，请遵循相关开源协议并保留原作者信息。

> **特别声明**：请遵守目标网站的 Robots 协议、用户隐私与相关法律法规，合规地使用该爬虫框架。  
> 本项目仅供学习交流，若在实际使用中造成任何法律或合规风险，由使用者自行承担。

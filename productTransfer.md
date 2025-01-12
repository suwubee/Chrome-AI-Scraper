下面给出一个**三段式**（阶段式）脚本结构的示例，将「**采集**→**转化**→**上传**」流程拆分为三个主要阶段，并在每个阶段留有充分的注释与可扩展空间。这样，你可以很容易地在以后复用并扩展这三个阶段，用于更多种类似的「采集/转化/上传」场景。

---

## 代码结构说明

1. **主函数**：  
   - 包含 **(async function main(){ ... })** 自执行逻辑，作为脚本的统一入口。  
   - 内部分别调用 **采集**→**转化**→**上传**三个阶段的函数，并使用 `window.postMessage` 发送日志。  

2. **采集函数** `gatherData()`：  
   - 负责在网页上找到目标 `<script>` 标签、提取 JSON 数据，或根据页面结构获取相关的商品信息。  
   - 处理完毕后，返回一个原始的 `productData`。  

3. **转化函数** `transformToShopifyApiData()`：  
   - 负责把商品数据 `productData` 转换成特定的 Shopify API 需要的格式（含 `product_data`, `images`, `variants` 等）。  
   - 你也可以将转化逻辑更细分，比如再拆成多个小函数：处理图片URL、处理库存逻辑等。  

4. **上传函数** `submitToApi()`：  
   - 负责将转化后的数据通过 `XMLHttpRequest`（或 fetch）提交到 Shopify API 端点，并根据请求结果返回成功或错误信息。  
   - 也可以扩展为支持多种 API 端点，或添加更多鉴权、异步处理等。

---

## 优化后的示例脚本

```js
/***********************************************************
 * 主函数 - 三段式流程：采集 → 转化 → 上传
 ***********************************************************/
(async function main() {
  try {
    // ①【日志】开始脚本执行
    window.postMessage({
      type: 'updateStatus',
      data: "[Script] 开始执行..."
    }, '*');

    // ②【第一阶段】采集数据
    const productData = await gatherData();
    if (!productData) {
      // 如果返回空或 null，说明采集阶段失败或页面不符合预期
      return;
    }

    // ③【第二阶段】转化数据
    const apiData = transformToShopifyApiData(productData);

    // ④【第三阶段】上传数据
    await submitToApi(apiData);

  } catch (error) {
    // 全局捕捉：脚本最外层的异常
    window.postMessage({
      type: 'addLog',
      data: `[Script] 脚本执行出现错误: ${error.message}`
    }, '*');

    window.postMessage({
      type: 'updateParseResult',
      error: error.message
    }, '*');
  }
})();

/***********************************************************
 * 第一阶段：采集数据
 * - 查找目标 script 标签
 * - 判断是否为 "product" 页面
 * - 请求其他外部 JS 文件并解析
 * - 返回原始的 productData
 ***********************************************************/
async function gatherData() {
  // 1. 找到特定 id 和 type 的 script 标签
  const scriptElement = document.querySelector('script[id="shop-js-analytics"][type="application/json"]');
  if (!scriptElement) {
    window.postMessage({
      type: 'addLog',
      data: "[Script] 未找到符合条件的 <script> 标签."
    }, '*');
    return null;
  }

  window.postMessage({
    type: 'addLog',
    data: "[Script] 找到符合条件的 <script> 标签."
  }, '*');

  // 2. 尝试解析 JSON 内容
  let jsonData;
  try {
    jsonData = JSON.parse(scriptElement.textContent);
  } catch (error) {
    window.postMessage({
      type: 'addLog',
      data: `[Script] 解析 JSON 数据时出错: ${error.message}`
    }, '*');
    return null;
  }

  // 3. 判断页面类型是否是 "product"
  if (jsonData.pageType !== "product") {
    window.postMessage({
      type: 'addLog',
      data: "[Script] 当前页面不是商品页面."
    }, '*');
    return null;
  }

  window.postMessage({
    type: 'addLog',
    data: "[Script] 当前页面为商品页面."
  }, '*');

  // 4. 根据当前 URL，拼接一个以 ".js" 结尾的新链接
  const currentUrl = window.location.href;
  const cleanUrl = currentUrl
    .split('?')[0]  // 移除查询参数
    .split('#')[0]  // 移除锚点
    .replace(/\.([^/]*)$/, '')  // 移除最后一个点后的扩展名
    .replace(/\/$/, '')         // 移除末尾的斜杠
    .replace(/\.js$/, '');      // 如果原本带 .js，则先移除
  const newUrl = cleanUrl + '.js';

  window.postMessage({
    type: 'addLog',
    data: `[Script] 生成的 JS 文件 URL: ${newUrl}`
  }, '*');

  // 5. 请求这个 .js 文件
  let productData = null;
  try {
    const response = await fetch(newUrl);
    if (!response.ok) {
      window.postMessage({
        type: 'addLog',
        data: `[Script] 请求失败，状态码: ${response.status}`
      }, '*');
      return null;
    }

    const jsContent = await response.text();
    window.postMessage({
      type: 'addLog',
      data: "[Script] 请求成功，JS 文件内容已获取."
    }, '*');

    // 6. 尝试解析 JS 文件内容为 JSON
    try {
      productData = JSON.parse(jsContent);
      window.postMessage({
        type: 'addLog',
        data: "[Script] JS 文件内容解析成功."
      }, '*');
    } catch (error) {
      window.postMessage({
        type: 'addLog',
        data: `[Script] 解析 JS 文件内容时出错: ${error.message}`
      }, '*');
      return null;
    }

  } catch (error) {
    window.postMessage({
      type: 'addLog',
      data: `[Script] 请求 JS 文件时出错: ${error.message}`
    }, '*');
    return null;
  }

  // 返回最终获取的 productData（若成功）
  return productData;
}

/***********************************************************
 * 第二阶段：转化数据
 * - 将原始的 productData 转换为 Shopify API 需要的格式
 * - 处理title/description/tags/images/variants等字段
 * - 返回可直接提交API的对象 (apiData)
 ***********************************************************/
function transformToShopifyApiData(productData) {
  // 组织 product_data
  const product_data = {
    title: productData.title,
    descriptionHtml: productData.description,
    vendor: productData.vendor,
    productType: productData.type,
    tags: productData.tags
  };

  // 修复图片地址
  const images = productData.images.map(img => {
    // 若 URL 以双斜杠开头，则加上 "https:"
    if (img.startsWith('//')) {
      return `https:${img}`;
    }
    return img;
  });

  // 转换 variants
  const variants = productData.variants.map(variant => {
    return {
      price: (variant.price / 100).toFixed(2),
      compareAtPrice: (variant.compare_at_price / 100).toFixed(2),
      sku: variant.sku,
      inventoryQuantity: variant.inventory_quantity || 20,
      optionValues: variant.options.map((option, idx) => {
        return { name: productData.options[idx].name, value: option };
      })
    };
  });

  // 可选：添加 metafields
  const metafields = [
    {
      namespace: "custom",
      key: "material",
      type: "single_line_text_field",
      value: "Sterling Silver"
    }
  ];

  // 组装 API 请求数据
  const apiData = {
    shop_name: "demo",  // TODO: 替换为实际店铺
    access_token: "shpat_111111111",  // TODO: 替换为实际Token
    product_data: product_data,
    images: images,
    variants: variants,
    metafields: metafields
  };

  return apiData;
}

/***********************************************************
 * 第三阶段：上传数据
 * - 将转化后的数据 (apiData) 通过 XMLHttpRequest 同步请求提交
 * - 或可改用 fetch + 适当的 CORS 配置
 * - 提交成功后，通过 addLog 或 updateParseResult 通知
 ***********************************************************/
  async function submitToApi(apiData) {
    const apiUrl = "https://shopify2025.seoark.com/api/upload?pwd=bilibilibing";
  
    try {
      // 提示开始上传
      window.postMessage({
        type: 'addLog',
        data: "[Script] 开始提交数据..."
      }, '*');
  
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiData)
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const result = await response.json();
      
      window.postMessage({
        type: 'addLog',
        data: "[Script] 数据提交成功"
      }, '*');
  
      window.postMessage({
        type: 'updateParseResult',
        data: result
      }, '*');
  
      return result;
  
    } catch (error) {
      window.postMessage({
        type: 'addLog',
        data: `[Script] 提交数据时出错: ${error.message}`
      }, '*');
  
      window.postMessage({
        type: 'updateParseResult',
        error: error.message
      }, '*');
  
      throw error;
    }
  }
```

---

## 代码亮点说明

1. **三大阶段**：  
   - `gatherData()`：通用的「**采集**」思路（可以更换查找标签或解析逻辑）；  
   - `transformToShopifyApiData()`：可复用于不同平台（只需更换内部字段映射）；  
   - `submitToApi()`：把**上传**的部分集中在一个函数里，后续若要改用 `fetch` 或者修改 API 地址，也只用改这里。

2. **一致的日志输出**：  
   - 全文仅通过 `window.postMessage({ type:'addLog' or 'updateParseResult' })` 发出日志与最终结果；  
   - 无需使用 `console.log`；  
   - 符合你在框架中统一管理日志信息的思路。

3. **可扩展性**：  
   - 如果你想在**第一阶段**再多爬取其他信息，如面包屑、SKU、或多页面翻页，只需拓展 `gatherData()`；  
   - 如果**第二阶段**需要对数据做更多处理，如国际化价格、动态属性，也可在 `transformToShopifyApiData()` 里再拆分多个辅助函数；  
   - 若**第三阶段**上传的目标端点不再是 Shopify，也可把它改为 `submitToApiXxx()` 或者用 `fetch` + 后端代理等。

---

## 可进一步改进/调整的点

1. **切换到 `fetch`**：  
   - 目前上传时用了 `XMLHttpRequest + 同步请求`。如要避免阻塞，可以用异步 `fetch` + `await`，并在服务器端正确设置 CORS，或使用扩展的后台脚本代理。

2. **敏感信息管理**：  
   - `access_token`、`apiUrl` 等配置可放到一个**配置文件**或**options 页面**，用 `chrome.storage.local` 动态读取，避免硬编码在脚本里。

3. **错误处理更细粒度**：  
   - 可在 `submitToApi` 中对服务器返回的错误码做更精细化的处理、或重试机制等。

4. **日志分级**：  
   - 如果需要在前端显示不同颜色的日志，可在 `data` 里添加 `level: 'info' | 'warn' | 'error'` 等字段，popup 页面再根据日志等级渲染不同样式。

---

### 总结

通过上述的三段式拆分，你可以：

- **更易维护**：每个阶段只关注「**采集** / **转化** / **上传**」一件事，后续修改只需聚焦于对应函数；  
- **更易复用**：你可以把 `gatherData` 换成别的网站的采集逻辑，`transformToShopifyApiData` 换成不同平台的数据格式，`submitToApi` 改成调另一端点或后端服务；  
- **更易阅读**：当别人接手或想改动流程时，一眼就能看到「哦，这里是先采集，再转化，最后上传」。

希望这份代码能帮助你在后续的爬虫或集成业务中，轻松快速地扩展和维护。祝开发顺利!
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
      shop_name: "your_store_name",  // TODO: 替换为实际店铺
      access_token: "shpat_111111111111111",  // TODO: 替换为实际Token
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
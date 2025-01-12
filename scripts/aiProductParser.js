/**
 * aiProductParser.js
 * 说明：AI辅助的产品数据解析脚本
 */

// 引入 HtmlCleaner 类
class HtmlCleaner {
    constructor() {
      this.metadata = {
        title: '',
        meta: {},
        stats: {
          removed: 0,
          preserved: 0
        }
      };
      this.status = {
        current: '准备中',
        captured: 0
      };
    }
  
    // 更新状态
    updateStatus(status, captured) {
      this.status.current = status;
      if (captured) {
        this.status.captured = captured;
      }
      // 发送状态更新消息
      window.postMessage({
        type: 'updateStatus',
        data: this.status
      }, '*');
    }
  
    // 添加日志
    addLog(message) {
      window.postMessage({
        type: 'addLog',
        data: message
      }, '*');
    }
  
    // 提取头部信息
    extractHeader(doc) {
      this.updateStatus('正在提取头部信息');
      this.addLog('开始提取页面头部信息...');
      
      // 提取标题
      this.metadata.title = doc.title || '';
  
      // 提取meta信息
      const metas = doc.getElementsByTagName('meta');
      for (const meta of metas) {
        const name = meta.getAttribute('name') || meta.getAttribute('property');
        const content = meta.getAttribute('content');
        if (name && content) {
          this.metadata.meta[name] = content;
        }
      }
      
      this.addLog(`提取到标题: ${this.metadata.title}`);
      this.addLog(`提取到 ${Object.keys(this.metadata.meta).length} 个meta标签`);
    }
  
    // 清理body内容
    cleanBody(doc) {
      this.updateStatus('正在清理页面内容');
      this.addLog('开始清理页面内容...');
  
      // 1. 移除脚本和样式
      ['script', 'style', 'link', 'iframe', 'noscript'].forEach(tag => {
        const elements = doc.getElementsByTagName(tag);
        this.metadata.stats.removed += elements.length;
        if (elements.length > 0) {
          this.addLog(`清理 ${tag} 标签 ${elements.length} 个`);
        }
        while (elements.length > 0) {
          elements[0].remove();
        }
      });
  
      // 2. 移除空节点和注释
      const walker = document.createTreeWalker(
        doc.body,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
        null,
        false
      );
  
      const nodesToRemove = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.nodeType === Node.COMMENT_NODE || 
            (node.nodeType === Node.ELEMENT_NODE && !node.textContent.trim())) {
          nodesToRemove.push(node);
        }
      }
  
      nodesToRemove.forEach(node => {
        node.remove();
        this.metadata.stats.removed++;
      });
  
      // 3. 清理属性
      const allElements = doc.body.getElementsByTagName('*');
      for (const el of allElements) {
        const attrs = el.attributes;
        for (let i = attrs.length - 1; i >= 0; i--) {
          const attr = attrs[i];
          if (attr.name.startsWith('on') || 
              ['style', 'class', 'id'].includes(attr.name)) {
            el.removeAttribute(attr.name);
          }
        }
        this.metadata.stats.preserved++;
      }
  
      this.updateStatus('清理完成', this.metadata.stats.preserved);
      this.addLog(`清理完成,保留了 ${this.metadata.stats.preserved} 个有效元素`);
      
      return doc.body.innerHTML
        .replace(/(\r\n|\n|\r|\t)/gm, '')
        .replace(/\s+/g, ' ')
        .replace(/> </g, '>\n<');
    }
  
    // 清理HTML
    clean(html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // 提取头部信息
      this.extractHeader(doc);
      
      // 清理body
      const cleanedBody = this.cleanBody(doc);
      
      return {
        metadata: this.metadata,
        body: cleanedBody,
        timestamp: new Date().toISOString()
      };
    }
  }


// AI解析器类
class AiProductParser {
  constructor() {
    this.metadata = {
      stats: {
        parsed: 0,
        failed: 0
      }
    };
  }

  async parseWithAI(cleanData, config) {
    const prompt = `
请基于以下框架代码和数据结构，生成一个完整的商品数据提取和提交脚本。特别注意日志输出和智能数据筛选。

1. 框架代码结构
\`\`\`javascript
// HtmlCleaner 类 - 用于清理和提取HTML数据
class HtmlCleaner {
  constructor() {
    this.metadata = {
      title: '',
      meta: {},
      stats: {
        removed: 0,
        preserved: 0
      }
    };
    this.status = {
      current: '准备中',
      captured: 0
    };
  }

  updateStatus(status, captured) {
    this.status.current = status;
    if (captured) {
      this.status.captured = captured;
    }
    window.postMessage({
      type: 'updateStatus',
      data: this.status
    }, '*');
  }

  addLog(message) {
    window.postMessage({
      type: 'addLog',
      data: message
    }, '*');
  }

  extractHeader(doc) {
    // ... 提取头部信息的代码
  }

  cleanBody(doc) {
    // ... 清理body内容的代码
  }

  clean(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    this.extractHeader(doc);
    const cleanedBody = this.cleanBody(doc);
    
    return {
      metadata: this.metadata,
      body: cleanedBody,
      timestamp: new Date().toISOString()
    };
  }
}

// 主函数示例 - 必须遵循此结构
(async function main() {
  console.log("[aiProductParser] 开始执行...");
  
  const config = {
    shopifyEndpoint: 'https://shopify2025.seoark.com/api/upload'
  };
  
  try {
    // 1. 从当前页面获取HTML
    const html = document.documentElement.outerHTML;
    
    // 2. 清理HTML
    const cleaner = new HtmlCleaner();
    const cleanedData = cleaner.clean(html);
    
    // 3. 提取商品数据
    const productData = extractProductData(cleanedData);
    
    // 4. 转换为Shopify格式
    const shopifyData = convertToShopifyFormat(productData);
    
    // 5. 提交到Shopify
    await submitToShopify(shopifyData, config);
    
    window.postMessage({
      type: 'updateParseResult',
      data: { cleanedData, productData, shopifyData }
    }, '*');
    
  } catch (error) {
    console.error("[aiProductParser] 错误:", error);
    window.postMessage({
      type: 'updateParseResult',
      error: error.message
    }, '*');
  }
})();
\`\`\`

2. 日志输出要求：
- 每个函数必须通过 window.postMessage 输出详细的执行状态
- 在关键数据提取点输出日志，例如：
  * "开始分析商品图片..."
  * "找到 X 张商品主图"
  * "找到 X 张商品细节图"
  * "过滤掉 X 张无关图片"
- 数据提取结果必须输出到控制台，格式如：
\`\`\`javascript
console.log("[extractProductData] 提取结果:", {
    title: "商品标题",
    images: "已过滤的商品图片",
    // ... 其他数据
});
\`\`\`
- 错误处理时必须提供详细的错误信息和位置

3. 智能数据筛选要求：
商品图片筛选规则：
- 分析图片容器的类名和结构特征（如 product-gallery, main-image 等）
- 排除页面装饰图片、图标、logo等
- 识别商品主图（通常位于页面顶部或左侧）
- 识别商品细节图（通常在描述区域）
- 图片URL需要符合以下特征之一：
  * 包含商品ID或SKU
  * 位于商品图片展示区域
  * 图片尺寸符合商品图片特征
  * 文件名包含 product、goods、item 等关键词

4. 当前清理后的HTML数据结构：
${JSON.stringify(cleanData, null, 2)}

5. 目标数据格式：
{
  "shop_name": "店铺名称",            // 必填，字符串
  "access_token": "访问令牌",         // 必填，字符串
  "product_data": {
    "title": "商品标题",              // 必填，从HTML中提取
    "descriptionHtml": "商品描述",    // 必填，从HTML中提取
    "vendor": "供应商",              // 必填，从HTML中提取
    "productType": "商品类型",        // 必填，从HTML中提取
    "tags": ["标签1", "标签2"]       // 选填，从HTML中提取
  },
  "images": [                        // 必须经过智能筛选的商品图片
    "商品主图URL",
    "商品细节图URL"
  ],
  "variants": [{                     // 必填，商品变体信息
    "price": "价格",                 // 必填，从HTML中提取
    "compareAtPrice": "对比价格",     // 选填，从HTML中提取
    "sku": "SKU编号",                // 必填，从HTML中提取
    "inventoryQuantity": 100,        // 必填，从HTML中提取
    "optionValues": [               // 选填，变体选项
      {
        "name": "选项名称",          // 如：颜色、尺寸
        "value": "选项值"           // 如：红色、XL
      }
    ]
  }]
}

6. 实现要求：
- 必须遵循框架代码结构
- 实现详细的日志输出系统
- 智能筛选商品图片
- 处理跨域请求（使用 mode: 'no-cors'）
- 在提交数据前输出完整的数据结构到日志

请生成以下函数的完整实现：
1. extractProductData(cleanedData) - 包含智能数据筛选
2. convertToShopifyFormat(productData) - 转换为Shopify格式
3. submitToShopify(shopifyData, config) - 提交数据（包含完整日志）

注意：
- 确保每个函数都有完整的日志输出
- 图片筛选逻辑必须准确
- 数据提取前后都要输出日志
- 处理所有可能的错误情况
- 验证数据完整性
`;

    try {
      const response = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`AI API错误: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;

    } catch (error) {
      console.error('AI解析失败:', error);
      throw error;
    }
  }
}

// 主函数
(async function main() {
  console.log("[aiProductParser] 开始执行...");
  
  // API配置
  const config = {
    apiEndpoint: 'https://chatapi.aisws.com/v1/chat/completions',
    shopifyEndpoint: 'https://shopify2025.seoark.com/api/upload',
    model: 'gpt-4o-2024-11-20',
    apiKey: 'sk-11111111' // 需要替换为实际的API密钥
  };
  
  try {
    // 1. 清理HTML
    const html = document.documentElement.outerHTML;
    const cleaner = new HtmlCleaner();
    const cleanedData = cleaner.clean(html);
    
    // 2. AI解析
    const parser = new AiProductParser();
    const aiResult = await parser.parseWithAI(cleanedData, config);
    
    // 3. 发送结果
    window.postMessage({
      type: 'updateParseResult',
      data: {
        cleanedData,
        aiAnalysis: aiResult
      }
    }, '*');
    
    console.log("[aiProductParser] 解析完成");
    
  } catch (error) {
    console.error("[aiProductParser] 错误:", error);
    window.postMessage({
      type: 'updateParseResult',
      error: error.message
    }, '*');
  }
})();
/**
 * htmlclean.js
 * 说明：提取页面关键信息，清理无关代码
 */

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
      data: {
        status: this.status.current,
        captured: this.status.captured
      }
    }, '*');
    console.log("[HtmlCleaner] 状态:", this.status);
  }

  // 添加日志
  addLog(message) {
    console.log("[HtmlCleaner]", message);
    window.postMessage({
      type: 'addLog',
      data: `[HtmlCleaner] ${message}`
    }, '*');
  }

  // 提取头部信息
  extractHeader(doc) {
    this.updateStatus('正在提取头部信息');
    this.addLog('开始提取页面头部信息...');
    
    // 提取标题
    this.metadata.title = doc.title || '';
    this.addLog(`提取到标题: ${this.metadata.title}`);

    // 提取meta信息
    const metas = doc.getElementsByTagName('meta');
    let metaCount = 0;
    for (const meta of metas) {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const content = meta.getAttribute('content');
      if (name && content) {
        this.metadata.meta[name] = content;
        metaCount++;
      }
    }
    
    this.addLog(`提取到 ${metaCount} 个meta标签`);
    this.updateStatus('头部信息提取完成', metaCount);
  }

  // 清理body内容
  cleanBody(doc) {
    this.updateStatus('正在清理页面内容');
    this.addLog('开始清理页面内容...');

    // 1. 移除脚本和样式
    ['script', 'style', 'link', 'iframe', 'noscript'].forEach(tag => {
      const elements = doc.getElementsByTagName(tag);
      const count = elements.length;
      if (count > 0) {
        this.metadata.stats.removed += count;
        this.addLog(`清理 ${tag} 标签 ${count} 个`);
        while (elements.length > 0) {
          elements[0].remove();
        }
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
    this.addLog(`清理了 ${nodesToRemove.length} 个空节点和注释`);

    // 3. 清理属性
    const allElements = doc.body.getElementsByTagName('*');
    let attrCount = 0;
    for (const el of allElements) {
      const attrs = el.attributes;
      for (let i = attrs.length - 1; i >= 0; i--) {
        const attr = attrs[i];
        if (attr.name.startsWith('on') || 
            ['style', 'class', 'id'].includes(attr.name)) {
          el.removeAttribute(attr.name);
          attrCount++;
        }
      }
      this.metadata.stats.preserved++;
    }

    this.updateStatus('清理完成', this.metadata.stats.preserved);
    this.addLog(`清理完成: 移除 ${this.metadata.stats.removed} 个节点, ${attrCount} 个属性, 保留 ${this.metadata.stats.preserved} 个有效元素`);
    
    return doc.body.innerHTML
      .replace(/(\r\n|\n|\r|\t)/gm, '')
      .replace(/\s+/g, ' ')
      .replace(/> </g, '>\n<');
  }

  // 清理HTML
  clean(html) {
    console.log("[HtmlCleaner] 开始执行...");
    this.updateStatus('开始清理HTML');
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    this.extractHeader(doc);
    const cleanedBody = this.cleanBody(doc);
    
    const result = {
      metadata: this.metadata,
      body: cleanedBody,
      timestamp: new Date().toISOString()
    };

    // 发送最终结果
    window.postMessage({
      type: 'updateParseResult',
      data: {
        cleanedData: result
      }
    }, '*');

    console.log("[HtmlCleaner] 清理完成:", result);
    return result;
  }
}

// 主函数
(async function main() {
  console.log("[htmlclean] 开始清理...");
  
  try {
    const html = document.documentElement.outerHTML;
    const cleaner = new HtmlCleaner();
    const result = cleaner.clean(html);
    
    window.postMessage({
      type: 'updateParseResult',
      data: result
    }, '*');
    
    console.log("[htmlclean] 完成:", result.metadata);
    
  } catch (error) {
    console.error("[htmlclean] 错误:", error);
    window.postMessage({
      type: 'updateParseResult',
      error: error.message
    }, '*');
  }
})();
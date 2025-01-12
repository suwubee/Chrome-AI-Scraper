/**
 * demoScript.js
 * 说明：产品数据解析脚本
 */

// 产品解析器类
class ProductParser {
    constructor() {
      this.shopifyData = {
        shop_name: "",
        access_token: "",
        product_data: {
          title: "",
          descriptionHtml: "",
          vendor: "",
          productType: "",
          tags: []
        },
        images: [],
        variants: [],
        metafields: []
      };
    }
  
    parseTitle(doc) {
      const titleElement = doc.querySelector('.page-title .base');
      if (titleElement) {
        this.shopifyData.product_data.title = titleElement.textContent.trim();
      }
    }
  
    parseDescription(doc) {
      const descElement = doc.querySelector('#descriptionContent');
      if (descElement) {
        this.shopifyData.product_data.descriptionHtml = descElement.textContent.trim();
      }
    }
  
    parseImages(doc) {
      const images = doc.querySelectorAll('.product__image img');
      this.shopifyData.images = Array.from(images).map(img => {
        const mainSrc = img.getAttribute('data-main-src');
        return mainSrc || img.src;
      }).filter(Boolean);
    }
  
    parseVariants(doc) {
      const variants = [];
      
      // 首先定位到商品选项区域
      const optionsWrapper = doc.querySelector('#product-options-wrapper');
      if (!optionsWrapper) {
        return [];
      }

      // 获取所有属性容器
      const attributeContainers = optionsWrapper.querySelectorAll('.swatch-attribute');
      if (!attributeContainers.length) {
        return [];
      }

      // 存储所有选项组
      const optionGroups = [];
      
      // 遍历每个属性容器，提取选项信息
      attributeContainers.forEach(container => {
        // 获取属性标签作为选项名称
        const labelElement = container.querySelector('.swatch-attribute-label');
        if (!labelElement) return;
        
        const optionName = labelElement.textContent.trim();
        const options = [];

        // 根据不同类型的选项提取值
        if (container.querySelector('.swatch-option.image')) {
          // 颜色选项
          const colorOptions = container.querySelectorAll('.swatch-option.image');
          colorOptions.forEach(option => {
            options.push({
              id: option.getAttribute('data-option-id'),
              value: option.getAttribute('data-option-label')?.replace(/\([^)]*\)/g, '').trim(),
              disabled: option.classList.contains('disabled'),
              selected: option.classList.contains('selected')
            });
          });
        } else if (container.querySelector('.swatch-option.text')) {
          // 文本选项（尺码等）
          const textOptions = container.querySelectorAll('.swatch-option.text');
          textOptions.forEach(option => {
            options.push({
              id: option.getAttribute('data-option-id'),
              value: option.getAttribute('data-option-label'),
              disabled: option.classList.contains('disabled'),
              selected: option.classList.contains('selected')
            });
          });
        }

        if (options.length) {
          optionGroups.push({
            name: optionName,
            options: options
          });
        }
      });

      // 获取价格
      const priceElement = doc.querySelector('.price-wrapper .price');
      const price = priceElement ? 
        priceElement.textContent.trim().replace(/[^0-9.,]/g, '') : 
        '0.00';

      // 获取基础SKU
      const formElement = doc.querySelector('form[data-product-sku]');
      const baseSku = formElement ? 
        formElement.getAttribute('data-product-sku').replace('$', '') : 
        '';

      // 递归生成所有可能的组合
      function generateCombinations(groups, current = [], index = 0) {
        if (index === groups.length) {
          // 创建变体
          const variant = {
            price: price,
            compareAtPrice: price,
            sku: baseSku + '-' + current.map(opt => opt.value).join('-'),
            inventoryQuantity: 20, // 默认库存为20
            optionValues: current.map((opt, i) => ({
              name: groups[i].name,
              value: opt.value
            }))
          };

          // 如果选项被标记为disabled，则库存为0
          if (current.some(opt => opt.disabled)) {
            variant.inventoryQuantity = 0;
          }

          variants.push(variant);
          return;
        }

        for (const option of groups[index].options) {
          generateCombinations(groups, [...current, option], index + 1);
        }
      }

      // 生成所有组合
      generateCombinations(optionGroups);

      this.shopifyData.variants = variants;
    }
  
    parseTags(doc) {
      const tags = new Set();
      
      const activityTags = doc.querySelectorAll('li.px-3.py-2.t-sm-uppercase');
      activityTags.forEach(tag => tags.add(tag.textContent.trim()));
  
      const fitElement = doc.querySelector('#product\\.fit\\.code\\.view');
      if (fitElement) {
        const fitText = fitElement.textContent.trim();
        fitText.split(',').forEach(fit => tags.add(fit.trim()));
      }
  
      this.shopifyData.product_data.tags = Array.from(tags);
    }
  
    parseMetafields(doc) {
      const metafields = [];
  
      const fitElement = doc.querySelector('#product\\.fit\\.code\\.view');
      if (fitElement) {
        metafields.push({
          namespace: "custom",
          key: "fit",
          type: "single_line_text_field",
          value: fitElement.textContent.replace('Fit:', '').trim()
        });
      }
  
      const weightElements = doc.querySelectorAll('.product__description');
      weightElements.forEach(el => {
        if (el.textContent.includes('Product Weight')) {
          metafields.push({
            namespace: "custom",
            key: "weight",
            type: "single_line_text_field",
            value: el.textContent.replace('Product Weight:', '').trim()
          });
        }
      });
  
      const featuresElements = doc.querySelectorAll('.list-[square] li');
      if (featuresElements.length > 0) {
        const features = Array.from(featuresElements)
          .map(el => `- ${el.textContent.trim()}`)
          .join('\n');
  
        metafields.push({
          namespace: "custom",
          key: "features",
          type: "multi_line_text_field",
          value: features
        });
      }
  
      this.shopifyData.metafields = metafields;
    }
  
    parse(html, config = {}) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
  
      this.shopifyData.shop_name = config.shop_name || "";
      this.shopifyData.access_token = config.access_token || "";
      this.shopifyData.product_data.vendor = "Peak Performance";
      this.shopifyData.product_data.productType = "Outerwear";
  
      this.parseTitle(doc);
      this.parseDescription(doc);
      this.parseImages(doc);
      this.parseVariants(doc);
      this.parseTags(doc);
      this.parseMetafields(doc);
  
      return this.shopifyData;
    }
  }
  
  // 主函数
  (async function main() {
    console.log("[demoScript] Running...");
    
    try {
      // 1. 获取当前页面的HTML内容
      const html = document.documentElement.outerHTML;
  
      // 2. 创建解析器实例并解析数据
      const parser = new ProductParser();
      const shopifyData = parser.parse(html, {
        shop_name: "your-shop-name",
        access_token: "your-access-token"
      });
  
      // 3. 使用window.postMessage发送数据
      window.postMessage({
        type: 'updateParseResult',
        data: shopifyData
      }, '*');
  
      console.log("[demoScript] 解析结果:", shopifyData);
      console.log("[demoScript] Finished execution.");
      
    } catch (error) {
      console.error("[demoScript] Error:", error);
      // 使用window.postMessage发送错误信息
      window.postMessage({
        type: 'updateParseResult',
        error: error.message
      }, '*');
    }
  })();
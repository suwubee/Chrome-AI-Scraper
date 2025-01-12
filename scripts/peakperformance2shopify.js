/***********************************************************
 * 主函数 - 三段式流程：采集 → 转化 → 上传
 ***********************************************************/
(async function main() {
  try {
    window.postMessage({
      type: 'updateStatus',
      data: "[Script] 开始执行..."
    }, '*');

    // 第一阶段：验证页面并采集数据
    const htmlData = await gatherData();
    if (!htmlData) {
      return;
    }

    // 第二阶段：转化数据
    const apiData = transformToShopifyApiData(htmlData);

    // 第三阶段：上传数据
    await submitToApi(apiData);

  } catch (error) {
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
 * - 验证URL是否为商品页面
 * - 获取页面HTML内容
 ***********************************************************/
async function gatherData() {
  // 1. 验证URL
  const currentUrl = window.location.href;
  if (!currentUrl.includes('/product/')) {
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

  // 2. 获取页面HTML
  const html = document.documentElement.outerHTML;
  
  return html;
}

/***********************************************************
 * 第二阶段：转化数据
 * - 使用DOMParser解析HTML
 * - 提取所需的商品信息
 * - 转换为Shopify API格式
 ***********************************************************/
function transformToShopifyApiData(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 提取基础信息
  const title = doc.querySelector('.page-title .base')?.textContent.trim() || '';
  const description = doc.querySelector('#descriptionContent')?.textContent.trim() || '';
  
  // 提取图片
  const images = Array.from(doc.querySelectorAll('.product__image img'))
    .map(img => {
      const mainSrc = img.getAttribute('data-main-src') || img.src;
      return mainSrc.startsWith('//') ? `https:${mainSrc}` : mainSrc;
    })
    .filter(Boolean);

  // 提取变体信息 - 使用新的提取逻辑
  const variants = [];
  
  // 首先定位到商品选项区域
  const optionsWrapper = doc.querySelector('#product-options-wrapper');
  if (optionsWrapper) {
    // 获取所有属性容器
    const attributeContainers = optionsWrapper.querySelectorAll('.swatch-attribute');
    const optionGroups = [];
    
    // 遍历每个属性容器，提取选项信息
    attributeContainers.forEach(container => {
      const labelElement = container.querySelector('.swatch-attribute-label');
      if (!labelElement) return;
      
      const optionName = labelElement.textContent.trim();
      const options = [];

      // 根据不同类型的选项提取值
      if (container.querySelector('.swatch-option.image')) {
        // 颜色选项
        const colorOptions = container.querySelectorAll('.swatch-option.image');
        colorOptions.forEach(option => {
          // 获取图片URL
          const imageUrl = option.getAttribute('data-option-tooltip-thumb');
          // 清理URL，移除参数
          const cleanImageUrl = imageUrl ? imageUrl.split('?')[0] : null;
          
          options.push({
            id: option.getAttribute('data-option-id'),
            value: option.getAttribute('data-option-label')?.replace(/\([^)]*\)/g, '').trim(),
            disabled: option.classList.contains('disabled'),
            selected: option.classList.contains('selected'),
            image_url: cleanImageUrl
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

    // 价格处理函数
    function formatPrice(priceStr) {
      // 移除所有空格
      priceStr = priceStr.replace(/\s/g, '');
      // 将逗号替换为点，作为小数点
      priceStr = priceStr.replace(',', '.');
      // 移除除了数字和小数点之外的所有字符
      priceStr = priceStr.replace(/[^\d.]/g, '');
      // 确保是两位小数
      const price = parseFloat(priceStr).toFixed(2);
      return price;
    }

    // 获取价格
    const priceElement = doc.querySelector('.price-wrapper .price');
    const price = priceElement ? 
      formatPrice(priceElement.textContent.trim()) : 
      '0.00';

    // 获取基础SKU
    const formElement = doc.querySelector('form[data-product-sku]');
    const baseSku = formElement ? 
      formElement.getAttribute('data-product-sku').replace('$', '') : 
      '';

    // 递归生成所有可能的组合
    function generateCombinations(groups, current = [], index = 0) {
      if (index === groups.length) {
        const variant = {
          price: price,
          compareAtPrice: price,
          sku: baseSku + '-' + current.map(opt => opt.value).join('-'),
          inventoryQuantity: 20,
          optionValues: current.map((opt, i) => ({
            name: groups[i].name,
            value: opt.value
          }))
        };

        // 如果是颜色选项且有图片，添加到变体
        const colorOption = current.find(opt => opt.image_url);
        if (colorOption) {
          variant.image_url = colorOption.image_url;
        }

        // 检查库存状态
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
  }

  // 提取标签
  const tags = new Set();
  doc.querySelectorAll('li.px-3.py-2.t-sm-uppercase').forEach(tag => 
    tags.add(tag.textContent.trim())
  );
  const fitElement = doc.querySelector('#product\\.fit\\.code\\.view');
  if (fitElement) {
    fitElement.textContent.trim().split(',').forEach(fit => 
      tags.add(fit.trim())
    );
  }

  // 组装API数据
  const apiData = {
    shop_name: "your_store_name",
    access_token: "shpat_111111111",
    product_data: {
      title: title,
      descriptionHtml: description,
      vendor: "Peak Performance",
      productType: "Outerwear",
      tags: Array.from(tags)
    },
    images: images,
    variants: variants,
    metafields: [
      {
        namespace: "custom",
        key: "fit",
        type: "single_line_text_field",
        value: fitElement?.textContent.replace('Fit:', '').trim() || ''
      }
    ]
  };

  return apiData;
}

/***********************************************************
 * 第三阶段：上传数据 (保持不变)
 ***********************************************************/
async function submitToApi(apiData) {
  const apiUrl = "https://shopify2025.seoark.com/api/upload?pwd=bilibilibing";

  try {
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

function transformVariants(variants, options) {
  return variants.map(variant => {
    const optionValues = [];
    const variantData = {
      price: variant.price,
      compareAtPrice: variant.original_price,
      sku: variant.sku,
      inventoryQuantity: variant.stock
    };

    // 处理选项值和图片
    options.forEach((option, index) => {
      const value = variant[`option${index + 1}`];
      optionValues.push({
        name: option.name,
        value: value
      });
      
      // 如果该选项有对应的图片URL
      if (option.values && option.values[value] && option.values[value].image) {
        // 去掉URL中?后的参数
        const imageUrl = option.values[value].image.split('?')[0];
        variantData.image_url = imageUrl;
      }
    });

    variantData.optionValues = optionValues;
    return variantData;
  });
}

function transformOptions(rawOptions) {
  return rawOptions.map(option => {
    const values = {};
    
    // 处理选项值和图片
    Object.entries(option.values).forEach(([value, data]) => {
      values[value] = {
        ...data,
        // 如果有图片,去掉URL中?后的参数
        image: data.image ? data.image.split('?')[0] : null
      };
    });

    return {
      name: option.name,
      values
    };
  });
} 
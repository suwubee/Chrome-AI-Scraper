/**
 * demoScript.js
 * 说明：本脚本中仅演示了抓取并点击一个 XPath 定位的按钮。
 * 你可以在此编写自己的爬虫逻辑、数据采集、导出等操作。
 */

// XPath 查找元素函数
function findByXPath(xpath) {
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return result.singleNodeValue;
  }
  
  // 点击元素函数
  function clickElement(el) {
    if (!el) return false;
    el.click();
    // 如果需要更逼真的模拟，也可 dispatch MouseEvent
    return true;
  }
  
  // 主函数
  (async function main() {
    console.log("[demoScript] Running...");
  
    // 1) 准备定位按钮的 XPath
    const loadMoreXPath = '//*[@id="__next"]/div/main/div[3]/div[2]/div[2]/div/a/button';
  
    // 2) 查找并点击
    const button = findByXPath(loadMoreXPath);
    if (button) {
      console.log("[demoScript] Found button, attempting to click...");
      const success = clickElement(button);
      if (success) console.log("[demoScript] Button clicked successfully!");
      else console.log("[demoScript] Button click failed!");
    } else {
      console.log("[demoScript] Button not found!");
    }
  
    console.log("[demoScript] Finished execution.");
  })();
  
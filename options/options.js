// options.js

const scriptNameInput = document.getElementById("scriptName");
const scriptContentArea = document.getElementById("scriptContent");
const messageDiv = document.getElementById("message");
const scriptListContainer = document.getElementById("scriptList");
let currentSelectedScript = null;

// 更新脚本列表显示
function updateScriptList() {
    // 使用 Promise 方式获取存储的脚本
    chrome.storage.local.get(null).then((data) => {
        //console.log("Current scripts:", data); // 调试日志
        
        scriptListContainer.innerHTML = '<h3>已保存的脚本：</h3>';
        const scripts = Object.keys(data);
        
        if (scripts.length === 0) {
            scriptListContainer.innerHTML += '<p>暂无保存的脚本</p>';
            return;
        }

        const ul = document.createElement('ul');
        ul.className = 'script-list';
        
        scripts.forEach(name => {
            const li = document.createElement('li');
            li.className = 'script-item';
            if (name === currentSelectedScript) {
                li.classList.add('selected');
            }
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'script-name';
            nameSpan.textContent = name;
            
            // 单击选择脚本
            nameSpan.onclick = () => {
                document.querySelectorAll('.script-item').forEach(item => {
                    item.classList.remove('selected');
                });
                li.classList.add('selected');
                currentSelectedScript = name;
                loadScript(name);
            };
            
            // 双击编辑脚本
            nameSpan.ondblclick = () => {
                loadScript(name);
            };
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '删除';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if (name === 'demoScript') {
                    messageDiv.innerText = "默认脚本不能删除";
                    messageDiv.style.color = "red";
                    return;
                }
                deleteScript(name);
            };
            
            li.appendChild(nameSpan);
            li.appendChild(deleteBtn);
            ul.appendChild(li);
        });
        
        scriptListContainer.appendChild(ul);
    }).catch(error => {
        console.error("Error loading scripts:", error);
        messageDiv.innerText = "加载脚本列表失败";
        messageDiv.style.color = "red";
    });
}

// 加载脚本
function loadScript(name) {
    chrome.storage.local.get(name).then(data => {
        if (data[name]) {
            scriptNameInput.value = name;
            scriptContentArea.value = data[name];
            messageDiv.innerText = `脚本 "${name}" 已加载到编辑器`;
            messageDiv.style.color = "green";
        }
    }).catch(error => {
        console.error("Error loading script:", error);
        messageDiv.innerText = "加载脚本失败";
        messageDiv.style.color = "red";
    });
}

// 删除脚本
function deleteScript(name) {
    if (confirm(`确定要删除脚本 "${name}" 吗？`)) {
        chrome.storage.local.remove(name).then(() => {
            messageDiv.innerText = `脚本 "${name}" 已删除`;
            messageDiv.style.color = "green";
            if (currentSelectedScript === name) {
                currentSelectedScript = null;
                scriptNameInput.value = '';
                scriptContentArea.value = '';
            }
            updateScriptList();
        }).catch(error => {
            console.error("Error deleting script:", error);
            messageDiv.innerText = "删除脚本失败";
            messageDiv.style.color = "red";
        });
    }
}

// 保存脚本按钮事件监听
document.getElementById("btn-save").addEventListener("click", () => {
    const scriptName = scriptNameInput.value.trim();
    const scriptContent = scriptContentArea.value.trim();
    
    console.log("Save button clicked");
    console.log("Script name:", scriptName);
    console.log("Script content length:", scriptContent.length);
    
    if (!scriptName) {
        messageDiv.innerText = "请输入脚本名称";
        messageDiv.style.color = "red";
        return;
    }

    if (!scriptContent) {
        messageDiv.innerText = "请输入脚本内容";
        messageDiv.style.color = "red";
        return;
    }

    // 直接使用 chrome.storage.local
    try {
        chrome.storage.local.set({ [scriptName]: scriptContent })
            .then(() => {
                console.log(`保存脚本成功: ${scriptName}`);
                messageDiv.innerText = `脚本 "${scriptName}" 保存成功`;
                messageDiv.style.color = "green";
                currentSelectedScript = scriptName;
                return updateScriptList();
            })
            .catch(error => {
                console.error("保存脚本失败:", error);
                messageDiv.innerText = "保存失败：" + error.message;
                messageDiv.style.color = "red";
            });
    } catch (error) {
        console.error("保存脚本时发生错误:", error);
        messageDiv.innerText = "保存出错：" + error.message;
        messageDiv.style.color = "red";
    }
});

// 修改初始化逻辑
document.addEventListener('DOMContentLoaded', () => {
    console.log("Options页面已加载");
    
    // 测试storage权限
    chrome.storage.local.get(null)
        .then(data => {
            console.log("成功读取storage数据:", data);
            if (Object.keys(data).length === 0) {
                console.log("storage为空，准备加载demo脚本");
                return loadDemoScript();
            } else {
                console.log("找到现有脚本");
                return updateScriptList();
            }
        })
        .catch(error => {
            console.error("读取storage失败:", error);
            messageDiv.innerText = "初始化失败：" + error.message;
            messageDiv.style.color = "red";
        });
});

// 加载演示脚本
async function loadDemoScript() {
    try {
        console.log("开始加载demo脚本");
        const response = await fetch(chrome.runtime.getURL('scripts/demoScript.js'));
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const content = await response.text();
        console.log("Demo脚本内容已加载");
        
        await chrome.storage.local.set({ 'demoScript': content });
        console.log("Demo脚本已保存到storage");
        
        currentSelectedScript = 'demoScript';
        await updateScriptList();
        await loadScript('demoScript');
        
        messageDiv.innerText = "演示脚本已加载";
        messageDiv.style.color = "green";
    } catch (error) {
        console.error("加载demo脚本失败:", error);
        messageDiv.innerText = "加载演示脚本失败：" + error.message;
        messageDiv.style.color = "red";
    }
}


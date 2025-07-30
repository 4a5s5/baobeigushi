// 模式切换功能
document.addEventListener('DOMContentLoaded', function() {
    // 获取模式切换按钮和模式容器
    const toggleModeBtn = document.getElementById('toggleMode');
    const modeTextSpan = document.getElementById('modeText');
    const chatModeDiv = document.getElementById('chatMode');
    const ttsModeDiv = document.getElementById('ttsMode');
    
    // 从本地存储中获取上次使用的模式
    const lastMode = localStorage.getItem('lastMode') || 'chat';
    
    // 初始化页面时设置正确的模式
    if (lastMode === 'tts') {
        chatModeDiv.style.display = 'none';
        ttsModeDiv.style.display = 'block';
        modeTextSpan.textContent = '切换到对话模式';
    } else {
        chatModeDiv.style.display = 'block';
        ttsModeDiv.style.display = 'none';
        modeTextSpan.textContent = '切换到TTS模式';
    }
    
    // 添加模式切换按钮点击事件
    toggleModeBtn.addEventListener('click', function() {
        if (chatModeDiv.style.display !== 'none') {
            // 切换到TTS模式
            chatModeDiv.style.display = 'none';
            ttsModeDiv.style.display = 'block';
            modeTextSpan.textContent = '切换到对话模式';
            localStorage.setItem('lastMode', 'tts');
            
            // 触发Vue应用的挂载事件（如果已经加载）
            if (window.mountTtsApp && typeof window.mountTtsApp === 'function') {
                window.mountTtsApp();
            }
        } else {
            // 切换到对话模式
            chatModeDiv.style.display = 'block';
            ttsModeDiv.style.display = 'none';
            modeTextSpan.textContent = '切换到TTS模式';
            localStorage.setItem('lastMode', 'chat');
        }
    });
    
    console.log('模式切换功能已初始化');
});
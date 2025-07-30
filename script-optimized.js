// 优化版本的JavaScript - 解决加载慢和格式丢失问题

// 全局变量
let apiConfig = {};
let customAPIs = {};
let currentMode = 'chat';
let chatHistory = [];
let currentAudio = null;
let isPlaying = false;
let isGenerating = false;
let currentAudioURL = null;

// 错误重试机制
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// 网络状态检测
let isOnline = navigator.onLine;
let networkQuality = 'good'; // good, slow, offline

// 监听网络状态变化
window.addEventListener('online', function() {
    isOnline = true;
    networkQuality = 'good';
    showInfo('网络连接已恢复');
    console.log('网络连接已恢复');
});

window.addEventListener('offline', function() {
    isOnline = false;
    networkQuality = 'offline';
    showWarning('网络连接已断开，部分功能可能无法使用');
    console.log('网络连接已断开');
});

// 检测网络质量
async function checkNetworkQuality() {
    if (!isOnline) {
        networkQuality = 'offline';
        return networkQuality;
    }
    
    try {
        const startTime = Date.now();
        const response = await fetch('/api/voices?test=1', {
            method: 'GET',
            cache: 'no-cache'
        });
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        if (responseTime < 1000) {
            networkQuality = 'good';
        } else if (responseTime < 3000) {
            networkQuality = 'slow';
        } else {
            networkQuality = 'poor';
        }
        
        console.log(`网络质量检测: ${networkQuality} (${responseTime}ms)`);
    } catch (error) {
        networkQuality = 'poor';
        console.warn('网络质量检测失败:', error);
    }
    
    return networkQuality;
}

// API配置
const API_CONFIG = {
    'edge-api': {
        url: '/api/tts'
    },
    'oai-tts': {
        url: 'https://oai-tts.zwei.de.eu.org/v1/audio/speech'
    }
};

// AI设置默认值
const DEFAULT_AI_SETTINGS = {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    systemPrompt: '你是一个友善、有趣的AI语音助手。请用简洁、自然的语言回复用户，保持对话轻松愉快。回复长度控制在100字以内，除非用户特别要求详细解释。',
    temperature: 0.7,
    maxTokens: 150
};

// 性能监控
const performanceMetrics = {
    startTime: Date.now(),
    loadTimes: {},
    errors: []
};

// 初始化应用
function initializeApp() {
    const initStartTime = Date.now();
    console.log('正在初始化应用...');
    
    // 检查必要的DOM元素
    if (!checkRequiredElements()) {
        showError('页面元素加载不完整，请刷新页面');
        return;
    }
    
    try {
        // 初始化基本功能
        showMode('chat');
        initializeAudioPlayer();
        setupEventListeners();
        loadAISettings();
        loadChatHistory();
        
        // 延迟加载非关键功能
        setTimeout(() => {
            loadSpeakersWithRetry();
            initializeSliders();
            
            // 检测网络质量
            checkNetworkQuality();
        }, 500);
        
        const initTime = Date.now() - initStartTime;
        performanceMetrics.loadTimes.initialization = initTime;
        console.log(`应用初始化完成 (${initTime}ms)`);
        
        // 显示性能报告
        setTimeout(() => {
            showPerformanceReport();
        }, 2000);
        
    } catch (error) {
        console.error('应用初始化失败:', error);
        performanceMetrics.errors.push({
            type: 'initialization',
            message: error.message,
            time: Date.now()
        });
        showError('应用初始化失败: ' + error.message);
    }
}

// 显示性能报告
function showPerformanceReport() {
    const totalTime = Date.now() - performanceMetrics.startTime;
    const report = {
        总加载时间: `${totalTime}ms`,
        网络状态: isOnline ? '在线' : '离线',
        网络质量: networkQuality,
        错误数量: performanceMetrics.errors.length,
        浏览器: navigator.userAgent.split(' ').pop()
    };
    
    console.log('性能报告:', report);
    
    // 如果加载时间过长，显示提示
    if (totalTime > 5000) {
        showWarning(`页面加载较慢 (${Math.round(totalTime/1000)}秒)，建议检查网络连接`);
    } else if (totalTime < 2000) {
        console.log('页面加载速度良好');
    }
}

// 检查必要的DOM元素
function checkRequiredElements() {
    const requiredElements = [
        '#chatMode', '#ttsMode', '#toggleMode', '#chatInput', 
        '#sendBtn', '#chatHistory', '#chatApi', '#chatSpeaker'
    ];
    
    for (const selector of requiredElements) {
        if (!$(selector).length) {
            console.error('缺少必要元素:', selector);
            return false;
        }
    }
    return true;
}

// 带重试的加载语音列表
async function loadSpeakersWithRetry(retryCount = 0) {
    try {
        await loadSpeakers();
    } catch (error) {
        console.error(`加载语音列表失败 (尝试 ${retryCount + 1}/${MAX_RETRIES}):`, error);
        
        if (retryCount < MAX_RETRIES - 1) {
            setTimeout(() => {
                loadSpeakersWithRetry(retryCount + 1);
            }, RETRY_DELAY * (retryCount + 1));
        } else {
            showError('语音列表加载失败，请检查网络连接后刷新页面');
            // 使用备用配置
            useBackupSpeakers();
        }
    }
}

// 备用语音配置
function useBackupSpeakers() {
    console.log('使用备用语音配置');
    
    apiConfig = {
        'edge-api': {
            speakers: {
                'zh-CN-XiaoxiaoNeural': '晓晓 (女声)',
                'zh-CN-YunxiNeural': '云希 (男声)',
                'zh-CN-YunyangNeural': '云扬 (男声)',
                'zh-CN-XiaoyiNeural': '晓伊 (女声)'
            }
        },
        'oai-tts': {
            speakers: {
                'alloy': 'Alloy',
                'echo': 'Echo', 
                'fable': 'Fable',
                'onyx': 'Onyx',
                'nova': 'Nova',
                'shimmer': 'Shimmer'
            }
        }
    };
    
    updateSpeakerOptions('edge-api', true);
    updateSpeakerOptions('edge-api', false);
}

// 加载语音列表
async function loadSpeakers() {
    try {
        // 首先尝试加载主要的speakers.json
        let response = await fetch('speakers.json', {
            method: 'GET',
            cache: 'force-cache' // 使用缓存
        });
        
        // 如果主文件加载失败，尝试备用文件
        if (!response.ok) {
            console.warn('主speakers.json加载失败，尝试备用文件');
            response = await fetch('speakers-backup.json', {
                method: 'GET',
                cache: 'force-cache'
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        apiConfig = data;
        
        loadCustomAPIs();
        updateApiOptions();
        updateSpeakerOptions($('#api').val() || 'edge-api', false);
        updateSpeakerOptions($('#chatApi').val() || 'edge-api', true);
        
        console.log('语音列表加载成功');
    } catch (error) {
        console.error('加载语音列表失败:', error);
        throw error;
    }
}

// 初始化滑块
function initializeSliders() {
    const sliders = [
        { id: 'chatRate', valueId: 'chatRateValue' },
        { id: 'chatPitch', valueId: 'chatPitchValue' },
        { id: 'rate', valueId: 'rateValue' },
        { id: 'pitch', valueId: 'pitchValue' },
        { id: 'temperature', valueId: 'tempValue' }
    ];
    
    sliders.forEach(slider => {
        updateSliderLabel(slider.id, slider.valueId);
    });
}

// 设置事件监听器
function setupEventListeners() {
    try {
        // 模式切换
        $('#toggleMode').off('click').on('click', function() {
            const newMode = currentMode === 'chat' ? 'tts' : 'chat';
            showMode(newMode);
        });
        
        // AI对话相关事件
        $('#sendBtn').off('click').on('click', sendMessage);
        $('#chatInput').off('keypress').on('keypress', function(e) {
            if (e.which === 13 && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // 语音控制事件
        $('#playBtn').off('click').on('click', playCurrentAudio);
        $('#pauseBtn').off('click').on('click', pauseCurrentAudio);
        $('#stopBtn').off('click').on('click', stopCurrentAudio);
        $('#replayBtn').off('click').on('click', replayCurrentAudio);
        
        // 设置相关事件
        $('#settingsBtn').off('click').on('click', function() {
            $('#aiSettingsModal').modal('show');
        });
        
        // TTS API管理按钮事件
        $('#manageApiBtn, #manageChatApiBtn').off('click').on('click', function() {
            $('#apiManagerModal').modal('show');
            loadSavedAPIs();
        });
        
        $('#saveAiSettings').off('click').on('click', saveAISettings);
        $('#clearChatBtn').off('click').on('click', clearChat);
        
        // 自定义API表单提交
        $('#customApiForm').off('submit').on('submit', function(e) {
            e.preventDefault();
            saveCustomAPI();
        });
        
        // 插入停顿按钮
        $('#insertPause').off('click').on('click', insertPauseTag);
        
        // TTS相关事件
        $('#generateButton').off('click').on('click', function() {
            if (canMakeRequest()) {
                generateVoice(false);
            }
        });
        
        $('#previewButton').off('click').on('click', function() {
            if (canMakeRequest()) {
                generateVoice(true);
            }
        });
        
        // API选择变化事件
        $('#chatApi, #api').off('change').on('change', function() {
            const apiName = $(this).val();
            const isChat = $(this).attr('id') === 'chatApi';
            updateSpeakerOptions(apiName, isChat);
        });
        
        console.log('事件监听器设置完成');
    } catch (error) {
        console.error('设置事件监听器失败:', error);
        showError('功能初始化失败，部分功能可能无法使用');
    }
}

// 模式切换
function showMode(mode) {
    try {
        currentMode = mode;
        
        if (mode === 'chat') {
            $('#chatMode').show();
            $('#ttsMode').hide();
            $('#modeText').text('切换到TTS模式');
        } else {
            $('#chatMode').hide();
            $('#ttsMode').show();
            $('#modeText').text('切换到对话模式');
        }
    } catch (error) {
        console.error('模式切换失败:', error);
        showError('模式切换失败');
    }
}

// AI对话功能
async function sendMessage() {
    const input = $('#chatInput');
    const message = input.val().trim();
    
    if (!message) return;
    
    try {
        // 添加用户消息到界面
        addMessageToChat('user', message);
        input.val('');
        
        // 添加到历史记录
        chatHistory.push({ role: 'user', content: message });
        
        // 显示加载状态
        const loadingId = addLoadingMessage();
        
        // 调用AI API
        const aiResponse = await callAIAPI(message);
        
        // 移除加载消息
        removeLoadingMessage(loadingId);
        
        // 添加AI回复到界面
        addMessageToChat('ai', aiResponse);
        
        // 添加到历史记录
        chatHistory.push({ role: 'assistant', content: aiResponse });
        
        // 保存聊天历史
        saveChatHistory();
        
        // 如果启用自动播放，则朗读AI回复
        if ($('#autoPlay').prop('checked')) {
            await speakText(aiResponse);
        }
        
    } catch (error) {
        console.error('发送消息失败:', error);
        removeLoadingMessage(loadingId);
        showError('AI回复失败: ' + error.message);
        addMessageToChat('ai', '抱歉，我现在无法回复。请检查AI设置或稍后再试。');
    }
}

// 调用AI API
async function callAIAPI(message) {
    const settings = getAISettings();
    
    if (!settings.apiKey) {
        throw new Error('请先在设置中配置AI API密钥');
    }
    
    // 构建消息历史（保留最近10条对话）
    const messages = [
        { role: 'system', content: settings.systemPrompt }
    ];
    
    const recentHistory = chatHistory.slice(-10);
    messages.push(...recentHistory);
    messages.push({ role: 'user', content: message });
    
    const response = await fetch(settings.apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
            model: settings.model,
            messages: messages,
            temperature: settings.temperature,
            max_tokens: settings.maxTokens
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

// 语音朗读功能
async function speakText(text) {
    try {
        const apiName = $('#chatApi').val();
        const voice = $('#chatSpeaker').val();
        const rate = parseInt($('#chatRate').val()) || 0;
        const pitch = parseInt($('#chatPitch').val()) || 0;
        
        if (!voice) {
            showWarning('请先选择语音');
            return;
        }
        
        // 生成语音
        const audioBlob = await generateTTSAudio(text, apiName, voice, rate, pitch);
        
        if (audioBlob) {
            // 播放语音
            await playAudioBlob(audioBlob);
        }
        
    } catch (error) {
        console.error('语音朗读失败:', error);
        showError('语音朗读失败: ' + error.message);
    }
}

// 生成TTS音频
async function generateTTSAudio(text, apiName, voice, rate = 0, pitch = 0) {
    const apiUrl = API_CONFIG[apiName]?.url;
    if (!apiUrl) {
        throw new Error('未知的API: ' + apiName);
    }
    
    const headers = {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json'
    };
    
    const requestBody = {
        text: text,
        voice: voice,
        rate: rate,
        pitch: pitch,
        preview: false
    };
    
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`服务器响应错误: ${response.status} - ${errorText || response.statusText}`);
    }
    
    return await response.blob();
}

// 播放音频Blob
async function playAudioBlob(blob) {
    return new Promise((resolve, reject) => {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        
        const audioUrl = URL.createObjectURL(blob);
        currentAudio = new Audio(audioUrl);
        
        currentAudio.onloadeddata = () => {
            updateAudioControls(true);
        };
        
        currentAudio.onplay = () => {
            isPlaying = true;
            updatePlayButton(true);
        };
        
        currentAudio.onpause = () => {
            isPlaying = false;
            updatePlayButton(false);
        };
        
        currentAudio.onended = () => {
            isPlaying = false;
            updatePlayButton(false);
            updateAudioControls(false);
            URL.revokeObjectURL(audioUrl);
            resolve();
        };
        
        currentAudio.onerror = (error) => {
            updateAudioControls(false);
            URL.revokeObjectURL(audioUrl);
            reject(new Error('音频播放失败'));
        };
        
        currentAudio.play().catch(reject);
    });
}

// 音频控制函数
function playCurrentAudio() {
    if (currentAudio && currentAudio.paused) {
        currentAudio.play();
    }
}

function pauseCurrentAudio() {
    if (currentAudio && !currentAudio.paused) {
        currentAudio.pause();
    }
}

function stopCurrentAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        isPlaying = false;
        updatePlayButton(false);
    }
}

function replayCurrentAudio() {
    if (currentAudio) {
        currentAudio.currentTime = 0;
        currentAudio.play();
    }
}

function updateAudioControls(hasAudio) {
    $('#playBtn, #pauseBtn, #stopBtn, #replayBtn').prop('disabled', !hasAudio);
}

function updatePlayButton(playing) {
    const playBtn = $('#playBtn');
    const pauseBtn = $('#pauseBtn');
    
    if (playing) {
        playBtn.prop('disabled', true);
        pauseBtn.prop('disabled', false);
    } else {
        playBtn.prop('disabled', false);
        pauseBtn.prop('disabled', true);
    }
}

// 聊天界面管理
function addMessageToChat(type, content) {
    try {
        const chatHistory = $('#chatHistory');
        const timestamp = new Date().toLocaleTimeString();
        
        // 移除欢迎消息
        chatHistory.find('.welcome-message').remove();
        
        const messageClass = type === 'user' ? 'message-user' : 'message-ai';
        const messageHtml = `
            <div class="message ${messageClass}">
                <div class="message-content">
                    ${content}
                </div>
                <div class="message-time">
                    ${timestamp}
                </div>
                ${type === 'ai' ? `
                    <div class="message-controls">
                        <button class="btn btn-sm btn-outline-primary speak-btn" data-text="${content.replace(/"/g, '&quot;')}">
                            <i class="fas fa-volume-up"></i> 朗读
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
        
        const messageElement = $(messageHtml);
        chatHistory.append(messageElement);
        
        // 绑定朗读按钮事件
        messageElement.find('.speak-btn').off('click').on('click', function() {
            const text = $(this).data('text');
            speakText(text);
        });
        
        // 滚动到底部
        chatHistory.scrollTop(chatHistory[0].scrollHeight);
    } catch (error) {
        console.error('添加消息失败:', error);
    }
}

function addLoadingMessage() {
    const chatHistory = $('#chatHistory');
    const loadingId = 'loading-' + Date.now();
    
    const loadingHtml = `
        <div class="message message-ai" id="${loadingId}">
            <div class="message-content">
                <div class="loading-indicator">
                    <i class="fas fa-spinner fa-spin"></i>
                    AI正在思考中...
                </div>
            </div>
        </div>
    `;
    
    chatHistory.append(loadingHtml);
    chatHistory.scrollTop(chatHistory[0].scrollHeight);
    
    return loadingId;
}

function removeLoadingMessage(loadingId) {
    $('#' + loadingId).remove();
}

function clearChat() {
    if (confirm('确定要清空对话历史吗？')) {
        $('#chatHistory').empty().append(`
            <div class="welcome-message">
                <div class="text-center p-4">
                    <i class="fas fa-robot fa-3x text-primary mb-3"></i>
                    <h5>你好！我是你的AI语音助手 🤖</h5>
                    <p class="text-muted">我可以和你聊天，并且会用语音朗读我的回复哦～</p>
                </div>
            </div>
        `);
        chatHistory = [];
        saveChatHistory();
    }
}

// 工具函数
function updateSpeakerOptions(apiName, isChat = false) {
    const speakerSelect = isChat ? $('#chatSpeaker') : $('#speaker');
    
    try {
        speakerSelect.empty().append(new Option('加载中...', ''));
        
        if (apiConfig[apiName] && apiConfig[apiName].speakers) {
            const speakers = apiConfig[apiName].speakers;
            speakerSelect.empty();
            
            Object.entries(speakers).forEach(([key, value]) => {
                speakerSelect.append(new Option(value, key));
            });
        } else {
            speakerSelect.empty().append(new Option('暂无可用语音', ''));
        }
    } catch (error) {
        console.error('更新语音选项失败:', error);
        speakerSelect.empty().append(new Option('加载失败', ''));
    }
}

function updateSliderLabel(sliderId, labelId) {
    try {
        const slider = $(`#${sliderId}`);
        const label = $(`#${labelId}`);
        
        if (slider.length && label.length) {
            label.text(slider.val());
            
            slider.off('input').on('input', function() {
                label.text(this.value);
            });
        }
    } catch (error) {
        console.error('更新滑块标签失败:', error);
    }
}

function canMakeRequest() {
    if (isGenerating) {
        showError('请等待当前语音生成完成');
        return false;
    }
    return true;
}

// AI设置管理
function loadAISettings() {
    try {
        const settings = getAISettings();
        $('#aiApiUrl').val(settings.apiUrl);
        $('#aiApiKey').val(settings.apiKey);
        $('#aiModel').val(settings.model);
        $('#systemPrompt').val(settings.systemPrompt);
        $('#temperature').val(settings.temperature);
        $('#maxTokens').val(settings.maxTokens);
        updateSliderLabel('temperature', 'tempValue');
    } catch (error) {
        console.error('加载AI设置失败:', error);
    }
}

function saveAISettings() {
    try {
        const settings = {
            apiUrl: $('#aiApiUrl').val().trim(),
            apiKey: $('#aiApiKey').val().trim(),
            model: $('#aiModel').val().trim(),
            systemPrompt: $('#systemPrompt').val().trim(),
            temperature: parseFloat($('#temperature').val()),
            maxTokens: parseInt($('#maxTokens').val())
        };
        
        localStorage.setItem('aiSettings', JSON.stringify(settings));
        $('#aiSettingsModal').modal('hide');
        showInfo('AI设置已保存');
    } catch (error) {
        console.error('保存AI设置失败:', error);
        showError('保存设置失败');
    }
}

function getAISettings() {
    try {
        const saved = localStorage.getItem('aiSettings');
        return saved ? JSON.parse(saved) : DEFAULT_AI_SETTINGS;
    } catch (error) {
        console.error('获取AI设置失败:', error);
        return DEFAULT_AI_SETTINGS;
    }
}

// 聊天历史管理
function saveChatHistory() {
    try {
        localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    } catch (error) {
        console.error('保存聊天历史失败:', error);
    }
}

function loadChatHistory() {
    try {
        const saved = localStorage.getItem('chatHistory');
        if (saved) {
            chatHistory = JSON.parse(saved);
            // 重新显示聊天历史
            chatHistory.forEach(msg => {
                if (msg.role === 'user') {
                    addMessageToChat('user', msg.content);
                } else if (msg.role === 'assistant') {
                    addMessageToChat('ai', msg.content);
                }
            });
        }
    } catch (error) {
        console.error('加载聊天历史失败:', error);
        chatHistory = [];
    }
}

// 消息提示函数
function showError(message) {
    showMessage(message, 'danger');
}

function showWarning(message) {
    showMessage(message, 'warning');
}

function showInfo(message) {
    showMessage(message, 'info');
}

function showMessage(message, type = 'danger') {
    try {
        // 确保toast容器存在
        if (!$('.toast-container').length) {
            $('body').append('<div class="toast-container"></div>');
        }
        
        const toast = $(`
            <div class="toast">
                <div class="toast-body toast-${type}">
                    ${message}
                </div>
            </div>
        `);
        
        $('.toast-container').append(toast);
        
        setTimeout(() => {
            toast.addClass('show');
        }, 100);
        
        setTimeout(() => {
            toast.removeClass('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    } catch (error) {
        console.error('显示消息失败:', error);
        // 备用方案
        alert(message);
    }
}

// 其他必要函数
function initializeAudioPlayer() {
    try {
        updateAudioControls(false);
        $('#download').addClass('disabled').attr('href', '#');
        $('#audio').attr('src', '');
    } catch (error) {
        console.error('初始化音频播放器失败:', error);
    }
}

function loadCustomAPIs() {
    try {
        const saved = localStorage.getItem('customAPIs');
        if (saved) {
            customAPIs = JSON.parse(saved);
            updateApiOptions();
        }
    } catch (error) {
        console.error('加载自定义API失败:', error);
        customAPIs = {};
    }
}

function updateApiOptions() {
    try {
        const apiSelects = $('#api, #chatApi');
        apiSelects.each(function() {
            const select = $(this);
            const currentValue = select.val();
            
            // 保存当前选择
            const savedValue = currentValue;
            
            // 清空并重新添加选项
            select.empty();
            select.append(new Option('Edge API', 'edge-api'));
            select.append(new Option('OAI-TTS API', 'oai-tts'));
            
            // 添加自定义API选项
            Object.keys(customAPIs).forEach(apiName => {
                select.append(new Option(customAPIs[apiName].name, apiName));
            });
            
            // 恢复之前的选择
            if (savedValue && select.find(`option[value="${savedValue}"]`).length) {
                select.val(savedValue);
            } else {
                select.val('edge-api');
            }
        });
    } catch (error) {
        console.error('更新API选项失败:', error);
    }
}

// TTS API管理功能
function loadSavedAPIs() {
    try {
        const container = $('#savedApisList');
        container.empty();
        
        if (Object.keys(customAPIs).length === 0) {
            container.append('<p class="text-muted">暂无自定义API</p>');
            return;
        }
        
        Object.keys(customAPIs).forEach(apiName => {
            const api = customAPIs[apiName];
            const item = $(`
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${api.name}</h6>
                        <small class="text-muted">${api.endpoint}</small>
                    </div>
                    <button class="btn btn-sm btn-danger" onclick="deleteCustomAPI('${apiName}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `);
            container.append(item);
        });
    } catch (error) {
        console.error('加载已保存API失败:', error);
    }
}

function saveCustomAPI() {
    try {
        const name = $('#apiName').val().trim();
        const format = $('#apiFormat').val();
        const endpoint = $('#apiEndpoint').val().trim();
        const apiKey = $('#apiKey').val().trim();
        const modelEndpoint = $('#modelEndpoint').val().trim();
        const manualSpeakers = $('#manualSpeakers').val().trim();
        
        if (!name || !endpoint) {
            showError('请填写API名称和端点URL');
            return;
        }
        
        const apiId = 'custom_' + Date.now();
        customAPIs[apiId] = {
            name: name,
            format: format,
            endpoint: endpoint,
            apiKey: apiKey,
            modelEndpoint: modelEndpoint,
            speakers: {}
        };
        
        // 处理手动输入的语音列表
        if (manualSpeakers) {
            const speakers = manualSpeakers.split(',').map(s => s.trim()).filter(s => s);
            speakers.forEach(speaker => {
                customAPIs[apiId].speakers[speaker] = speaker;
            });
        }
        
        // 保存到localStorage
        localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
        
        // 更新API选项
        updateApiOptions();
        
        // 重新加载已保存的API列表
        loadSavedAPIs();
        
        // 清空表单
        $('#customApiForm')[0].reset();
        
        showInfo('自定义API保存成功');
    } catch (error) {
        console.error('保存自定义API失败:', error);
        showError('保存失败: ' + error.message);
    }
}

function deleteCustomAPI(apiId) {
    if (confirm('确定要删除这个自定义API吗？')) {
        try {
            delete customAPIs[apiId];
            localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
            updateApiOptions();
            loadSavedAPIs();
            showInfo('自定义API已删除');
        } catch (error) {
            console.error('删除自定义API失败:', error);
            showError('删除失败: ' + error.message);
        }
    }
}

// 插入停顿标签功能
function insertPauseTag() {
    try {
        const textarea = $('#text')[0];
        const pauseSeconds = $('#pauseSeconds').val() || '1.0';
        
        if (!textarea) {
            showError('找不到文本输入框');
            return;
        }
        
        const pauseTime = parseFloat(pauseSeconds);
        if (isNaN(pauseTime) || pauseTime <= 0 || pauseTime > 100) {
            showError('停顿时间必须在0.01到100秒之间');
            return;
        }
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const breakTag = `<break time="${pauseTime}s"/>`;
        
        const newText = textarea.value.slice(0, start) + breakTag + textarea.value.slice(end);
        textarea.value = newText;
        
        // 更新字符计数
        updateCharCount();
        
        // 设置光标位置
        const newPos = start + breakTag.length;
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
        
        showInfo('停顿标签已插入');
    } catch (error) {
        console.error('插入停顿标签失败:', error);
        showError('插入失败: ' + error.message);
    }
}

// 字符计数更新
function updateCharCount() {
    try {
        const text = $('#text').val() || '';
        const length = text.length;
        const maxLength = 100000;
        const percentage = Math.round((length / maxLength) * 100);
        
        $('#charCount').text(`${percentage}% (${length}/${maxLength}字符)`);
        
        if (percentage > 90) {
            $('#charCount').addClass('text-danger');
        } else if (percentage > 70) {
            $('#charCount').addClass('text-warning').removeClass('text-danger');
        } else {
            $('#charCount').removeClass('text-danger text-warning');
        }
    } catch (error) {
        console.error('更新字符计数失败:', error);
    }
}

// 改进的TTS生成函数 - 参考Edge TTS实现
async function generateVoice(isPreview) {
    if (!canMakeRequest()) return;
    
    try {
        isGenerating = true;
        $('#generateButton, #previewButton').prop('disabled', true);
        $('#loading').show();
        
        const text = $('#text').val().trim();
        if (!text) {
            showError('请输入要转换的文本');
            return;
        }
        
        const apiName = $('#api').val();
        const voice = $('#speaker').val();
        
        if (!voice) {
            showError('请选择语音');
            return;
        }
        
        showMessage('正在生成语音...', 'info');
        
        // 根据API类型构建请求参数
        const requestData = buildTTSRequest(text, apiName, voice, isPreview);
        
        const audioBlob = await callTTSAPI(apiName, requestData);
        
        if (audioBlob) {
            if (currentAudioURL) {
                URL.revokeObjectURL(currentAudioURL);
            }
            currentAudioURL = URL.createObjectURL(audioBlob);
            
            // 更新UI
            $('#result').show();
            $('#audio').attr('src', currentAudioURL);
            $('#download').removeClass('disabled').attr('href', currentAudioURL);
            
            // 保存到历史记录
            if (!isPreview) {
                saveToHistory(text, voice, currentAudioURL);
            }
            
            showMessage(isPreview ? '试听生成成功' : '语音生成成功', 'info');
        }
        
    } catch (error) {
        console.error('生成语音失败:', error);
        showError('生成语音失败: ' + error.message);
    } finally {
        isGenerating = false;
        $('#generateButton, #previewButton').prop('disabled', false);
        $('#loading').hide();
    }
}

// 构建TTS请求参数
function buildTTSRequest(text, apiName, voice, isPreview) {
    const processedText = isPreview ? text.substring(0, 50) + '...' : text;
    
    if (apiName === 'oai-tts') {
        // OpenAI TTS格式
        return {
            model: 'tts-1',
            input: processedText,
            voice: voice,
            speed: 1.0,
            response_format: $('#audioFormat').val() || 'mp3'
        };
    } else if (customAPIs[apiName] && customAPIs[apiName].format === 'openai') {
        // 自定义OpenAI格式API
        return {
            model: 'tts-1',
            input: processedText,
            voice: voice,
            speed: 1.0
        };
    } else {
        // Edge API格式（默认）
        return {
            text: processedText,
            voice: voice,
            rate: parseInt($('#rate').val()) || 0,
            pitch: parseInt($('#pitch').val()) || 0,
            api: apiName,
            format: 'mp3',
            preview: isPreview
        };
    }
}

// 调用TTS API
async function callTTSAPI(apiName, requestData) {
    let apiUrl;
    let headers = {
        'Content-Type': 'application/json'
    };
    
    if (apiName === 'oai-tts') {
        apiUrl = 'https://oai-tts.zwei.de.eu.org/v1/audio/speech';
    } else if (customAPIs[apiName]) {
        apiUrl = customAPIs[apiName].endpoint;
        if (customAPIs[apiName].apiKey) {
            headers['Authorization'] = `Bearer ${customAPIs[apiName].apiKey}`;
        }
    } else {
        // 默认使用本地API
        apiUrl = '/api/tts';
    }
    
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`API请求失败: ${response.status} - ${errorText || response.statusText}`);
    }
    
    return await response.blob();
}

// 保存到历史记录
function saveToHistory(text, voice, audioUrl) {
    try {
        const history = JSON.parse(localStorage.getItem('ttsHistory') || '[]');
        const item = {
            id: Date.now(),
            text: text.length > 50 ? text.substring(0, 50) + '...' : text,
            fullText: text,
            voice: voice,
            audioUrl: audioUrl,
            timestamp: new Date().toLocaleString()
        };
        
        history.unshift(item);
        
        // 只保留最近20条记录
        if (history.length > 20) {
            history.splice(20);
        }
        
        localStorage.setItem('ttsHistory', JSON.stringify(history));
        updateHistoryDisplay();
    } catch (error) {
        console.error('保存历史记录失败:', error);
    }
}

// 更新历史记录显示
function updateHistoryDisplay() {
    try {
        const history = JSON.parse(localStorage.getItem('ttsHistory') || '[]');
        const container = $('#historyItems');
        container.empty();
        
        if (history.length === 0) {
            container.append('<p class="text-muted text-center">暂无历史记录</p>');
            return;
        }
        
        history.forEach(item => {
            const historyItem = $(`
                <div class="card mb-2">
                    <div class="card-body p-2">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <small class="text-muted">${item.timestamp}</small>
                                <p class="mb-1 small">${item.text}</p>
                                <small class="text-info">${item.voice}</small>
                            </div>
                            <div class="btn-group-vertical btn-group-sm">
                                <button class="btn btn-outline-primary btn-sm" onclick="playHistoryItem('${item.audioUrl}')">
                                    <i class="fas fa-play"></i>
                                </button>
                                <button class="btn btn-outline-success btn-sm" onclick="downloadHistoryItem('${item.audioUrl}', '${item.id}')">
                                    <i class="fas fa-download"></i>
                                </button>
                                <button class="btn btn-outline-secondary btn-sm" onclick="reuseHistoryItem('${item.fullText}', '${item.voice}')">
                                    <i class="fas fa-redo"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `);
            container.append(historyItem);
        });
    } catch (error) {
        console.error('更新历史记录显示失败:', error);
    }
}

// 历史记录相关函数
window.playHistoryItem = function(audioUrl) {
    const audio = $('#audio')[0];
    audio.src = audioUrl;
    audio.play();
};

window.downloadHistoryItem = function(audioUrl, itemId) {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `tts-${itemId}.mp3`;
    link.click();
};

window.reuseHistoryItem = function(text, voice) {
    $('#text').val(text);
    $('#speaker').val(voice);
    updateCharCount();
    showInfo('已恢复历史记录内容');
};

window.clearHistory = function() {
    if (confirm('确定要清空所有历史记录吗？')) {
        localStorage.removeItem('ttsHistory');
        updateHistoryDisplay();
        showInfo('历史记录已清空');
    }
};

// 页面加载完成后初始化
$(document).ready(function() {
    console.log('DOM加载完成，开始初始化应用');
    
    // 延迟初始化，确保所有资源加载完成
    setTimeout(() => {
        initializeApp();
    }, 100);
});

// 全局错误处理
window.addEventListener('error', function(event) {
    console.error('全局错误:', event.error);
    showError('发生未知错误，请刷新页面重试');
});

// 未处理的Promise拒绝
window.addEventListener('unhandledrejection', function(event) {
    console.error('未处理的Promise拒绝:', event.reason);
    showError('网络请求失败，请检查网络连接');
});

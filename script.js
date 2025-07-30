// 全局变量
let apiConfig;
let lastRequestTime = 0;
let currentAudioURL = null;
let requestCounter = 0;
let isGenerating = false;
let currentMode = 'chat'; // 'chat' 或 'tts'
let chatHistory = [];
let currentAudio = null;
let isPlaying = false;

// API配置
const API_CONFIG = {
    'edge-api': {
        url: '/api/tts'
    },
    'oai-tts': {
        url: 'https://oai-tts.zwei.de.eu.org/v1/audio/speech'
    }
};

let customAPIs = {};
let editingApiId = null;

// AI设置默认值
const DEFAULT_AI_SETTINGS = {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    systemPrompt: '你是一个友善、有趣的AI语音助手。请用简洁、自然的语言回复用户，保持对话轻松愉快。回复长度控制在100字以内，除非用户特别要求详细解释。',
    temperature: 0.7,
    maxTokens: 150
};

// 初始化
$(document).ready(function() {
    initializeApp();
    loadSpeakers();
    setupEventListeners();
    loadAISettings();
    loadChatHistory();
});

function initializeApp() {
    // 初始化模式
    showMode('chat');
    
    // 初始化音频播放器
    initializeAudioPlayer();
    
    // 初始化滑块
    updateSliderLabel('chatRate', 'chatRateValue');
    updateSliderLabel('chatPitch', 'chatPitchValue');
    updateSliderLabel('rate', 'rateValue');
    updateSliderLabel('pitch', 'pitchValue');
    updateSliderLabel('temperature', 'tempValue');
    
    // 添加toast容器
    if (!$('.toast-container').length) {
        $('body').append('<div class="toast-container"></div>');
    }
}

function setupEventListeners() {
    // 模式切换
    $('#toggleMode').on('click', function() {
        const newMode = currentMode === 'chat' ? 'tts' : 'chat';
        showMode(newMode);
    });
    
    // AI对话相关事件
    $('#sendBtn').on('click', sendMessage);
    $('#chatInput').on('keypress', function(e) {
        if (e.which === 13 && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 语音控制事件
    $('#playBtn').on('click', playCurrentAudio);
    $('#pauseBtn').on('click', pauseCurrentAudio);
    $('#stopBtn').on('click', stopCurrentAudio);
    $('#replayBtn').on('click', replayCurrentAudio);
    
    // 设置相关事件
    $('#settingsBtn').on('click', function() {
        $('#aiSettingsModal').modal('show');
    });
    
    $('#saveAiSettings').on('click', saveAISettings);
    $('#clearChatBtn').on('click', clearChat);
    
    // API管理事件
    $('#manageChatApiBtn, #manageApiBtn').on('click', function() {
        $('#apiManagerModal').modal('show');
        refreshSavedApisList();
    });
    
    // TTS相关事件
    $('#generateButton').on('click', function() {
        if (canMakeRequest()) {
            generateVoice(false);
        }
    });
    
    $('#previewButton').on('click', function() {
        if (canMakeRequest()) {
            generateVoice(true);
        }
    });
    
    // API选择变化事件
    $('#chatApi, #api').on('change', function() {
        const apiName = $(this).val();
        const isChat = $(this).attr('id') === 'chatApi';
        updateSpeakerOptions(apiName, isChat);
    });
    
    // 滑块事件
    $('#chatRate, #chatPitch, #rate, #pitch').on('input', function() {
        const id = $(this).attr('id');
        const valueId = id + 'Value';
        updateSliderLabel(id, valueId);
    });
    
    $('#temperature').on('input', function() {
        updateSliderLabel('temperature', 'tempValue');
    });
    
    // 文本输入事件
    $('#text').on('input', updateCharCountText);
    
    // 停顿插入事件
    $('#insertPause').on('click', insertPause);
    
    // 自定义API表单事件
    $('#customApiForm').on('submit', saveCustomAPI);
}

// 模式切换
function showMode(mode) {
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
}

// AI对话功能
async function sendMessage() {
    const input = $('#chatInput');
    const message = input.val().trim();
    
    if (!message) return;
    
    // 添加用户消息到界面
    addMessageToChat('user', message);
    input.val('');
    
    // 添加到历史记录
    chatHistory.push({ role: 'user', content: message });
    
    // 显示加载状态
    const loadingId = addLoadingMessage();
    
    try {
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
        removeLoadingMessage(loadingId);
        showError('AI回复失败: ' + error.message);
        addMessageToChat('ai', '抱歉，我现在无法回复。请检查AI设置或稍后再试。');
    }
}

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
        const rate = parseInt($('#chatRate').val());
        const pitch = parseInt($('#chatPitch').val());
        
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

async function generateTTSAudio(text, apiName, voice, rate = 0, pitch = 0) {
    const apiUrl = API_CONFIG[apiName]?.url;
    if (!apiUrl) {
        throw new Error('未知的API: ' + apiName);
    }
    
    const customApi = customAPIs[apiName];
    const apiFormat = customApi ? (customApi.format || 'openai') : (apiName === 'oai-tts' ? 'openai' : 'edge');
    
    const headers = {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json'
    };
    
    let requestBody;
    
    if (apiFormat === 'openai') {
        // 移除SSML标签
        text = text.replace(/<break\s+time=["'](\d+(?:\.\d+)?[ms]s?)["']\s*\/>/g, '');
        
        requestBody = {
            model: voice,
            input: text,
            voice: customApi ? "alloy" : voice,
            response_format: 'mp3'
        };
        
        if (customApi && customApi.apiKey) {
            headers['Authorization'] = `Bearer ${customApi.apiKey}`;
        }
    } else {
        // Edge API格式
        text = escapeXml(text);
        
        requestBody = {
            text: text,
            voice: voice,
            rate: rate,
            pitch: pitch,
            preview: false
        };
        
        if (customApi && customApi.apiKey) {
            if (customApi.apiKey.toLowerCase().startsWith('x-api-key:')) {
                const keyValue = customApi.apiKey.substring('x-api-key:'.length).trim();
                headers['x-api-key'] = keyValue;
            } else {
                headers['Authorization'] = `Bearer ${customApi.apiKey}`;
            }
        }
    }
    
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
    messageElement.find('.speak-btn').on('click', function() {
        const text = $(this).data('text');
        speakText(text);
    });
    
    // 滚动到底部
    chatHistory.scrollTop(chatHistory[0].scrollHeight);
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

// AI设置管理
function loadAISettings() {
    const settings = getAISettings();
    $('#aiApiUrl').val(settings.apiUrl);
    $('#aiApiKey').val(settings.apiKey);
    $('#aiModel').val(settings.model);
    $('#systemPrompt').val(settings.systemPrompt);
    $('#temperature').val(settings.temperature);
    $('#maxTokens').val(settings.maxTokens);
    updateSliderLabel('temperature', 'tempValue');
}

function saveAISettings() {
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
}

function getAISettings() {
    const saved = localStorage.getItem('aiSettings');
    return saved ? JSON.parse(saved) : DEFAULT_AI_SETTINGS;
}

// 聊天历史管理
function saveChatHistory() {
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
}

function loadChatHistory() {
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
}

// TTS相关功能（保留原有功能）
function loadSpeakers() {
    return $.ajax({
        url: 'speakers.json',
        method: 'GET',
        dataType: 'json',
        success: function(data) {
            apiConfig = data;
            
            // 加载自定义API
            loadCustomAPIs();
            
            // 更新API选择下拉菜单
            updateApiOptions();
            
            // 设置默认API
            updateSpeakerOptions($('#api').val(), false);
            updateSpeakerOptions($('#chatApi').val(), true);
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.error(`加载讲述者失败：${textStatus} - ${errorThrown}`);
            showError('加载讲述者失败，请刷新页面重试。');
        }
    });
}

function loadCustomAPIs() {
    try {
        const savedAPIs = localStorage.getItem('customAPIs');
        if (savedAPIs) {
            customAPIs = JSON.parse(savedAPIs);
            
            // 合并到API_CONFIG
            Object.keys(customAPIs).forEach(apiId => {
                API_CONFIG[apiId] = {
                    url: customAPIs[apiId].endpoint,
                    isCustom: true,
                    apiKey: customAPIs[apiId].apiKey,
                    format: customAPIs[apiId].format,
                    manual: customAPIs[apiId].manual,
                    maxLength: customAPIs[apiId].maxLength
                };
            });
        }
    } catch (error) {
        console.error('加载自定义API失败:', error);
    }
}

function updateApiOptions() {
    const apiSelects = $('#api, #chatApi');
    
    apiSelects.each(function() {
        const currentApi = $(this).val();
        
        // 清除除了内置选项之外的所有选项
        $(this).find('option:not([value="edge-api"]):not([value="oai-tts"])').remove();
        
        // 添加自定义API选项
        Object.keys(customAPIs).forEach(apiId => {
            $(this).append(new Option(customAPIs[apiId].name, apiId));
        });
        
        // 如果之前选择的是有效的选项，则恢复选择
        if (currentApi && (currentApi === 'edge-api' || currentApi === 'oai-tts' || customAPIs[currentApi])) {
            $(this).val(currentApi);
        }
    });
}

async function updateSpeakerOptions(apiName, isChat = false) {
    const speakerSelect = isChat ? $('#chatSpeaker') : $('#speaker');
    speakerSelect.empty().append(new Option('加载中...', ''));
    
    try {
        // 检查是否是自定义API
        if (customAPIs[apiName]) {
            const customApi = customAPIs[apiName];
            
            // 如果有手动设置的讲述人列表，使用它
            if (customApi.manual && customApi.manual.length) {
                speakerSelect.empty();
                customApi.manual.forEach(v => speakerSelect.append(new Option(v, v)));
            } 
            // 如果有API密钥和模型端点，尝试获取讲述人
            else if (customApi.apiKey && customApi.modelEndpoint) {
                try {
                    const speakers = await fetchCustomSpeakers(apiName);
                    speakerSelect.empty();
                    
                    if (Object.keys(speakers).length === 0) {
                        speakerSelect.append(new Option('未找到讲述人，请手动添加', ''));
                    } else {
                        Object.entries(speakers).forEach(([key, value]) => {
                            speakerSelect.append(new Option(value, key));
                        });
                    }
                } catch (error) {
                    console.error('获取自定义讲述人失败:', error);
                    speakerSelect.empty().append(new Option('获取讲述人失败，请手动添加', ''));
                }
            } else {
                speakerSelect.empty().append(new Option('请先获取模型或手动输入讲述人', ''));
            }
        } else if (apiConfig[apiName]) {
            // 使用预定义的speakers
            const speakers = apiConfig[apiName].speakers;
            speakerSelect.empty();
            
            Object.entries(speakers).forEach(([key, value]) => {
                speakerSelect.append(new Option(value, key));
            });
        } else {
            throw new Error(`未知的API: ${apiName}`);
        }
    } catch (error) {
        console.error('加载讲述者失败:', error);
        speakerSelect.empty().append(new Option('加载讲述者失败', ''));
        showError(`加载讲述者失败: ${error.message}`);
    }
    
    // 更新API提示信息
    if (!isChat) {
        updateApiTipsText(apiName);
    }
}

async function fetchCustomSpeakers(apiId) {
    const customApi = customAPIs[apiId];
    if (!customApi || !customApi.modelEndpoint) {
        return { 'default': '默认讲述者' };
    }
    
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // 如果有API密钥，添加授权头
        if (customApi.apiKey) {
            headers['Authorization'] = `Bearer ${customApi.apiKey}`;
        }
        
        const response = await fetch(customApi.modelEndpoint, {
            method: 'GET',
            headers: headers
        });
        
        if (!response.ok) {
            throw new Error(`获取讲述者失败: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 处理OpenAI格式的响应
        if (data.data && Array.isArray(data.data)) {
            const ttsModels = data.data.filter(model => 
                model.id.startsWith('tts-') || 
                ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(model.id)
            );
            
            if (ttsModels.length === 0) {
                return { 'default': '未找到TTS模型' };
            }
            
            // 创建讲述者映射
            const speakerMap = {};
            ttsModels.forEach(model => {
                speakerMap[model.id] = model.id;
            });
            
            // 保存到apiConfig以便后续使用
            if (!apiConfig[apiId]) {
                apiConfig[apiId] = {};
            }
            apiConfig[apiId].speakers = speakerMap;
            
            return speakerMap;
        } else {
            // 如果响应格式不匹配预期
            console.warn('API返回格式不是标准OpenAI格式:', data);
            return { 'default': '自定义讲述人' };
        }
    } catch (error) {
        console.error('获取自定义讲述者失败:', error);
        return { 'error': `错误: ${error.message}` };
    }
}

function updateApiTipsText(apiName) {
    const tips = {
        'edge-api': 'Edge API 请求应该不限次数',
        'oai-tts': 'OpenAI-TTS 支持情感调整，不支持停顿标签'
    };
    
    // 如果是自定义API
    if (customAPIs[apiName]) {
        const format = customAPIs[apiName].format || 'openai';
        const formatStr = format === 'openai' ? 'OpenAI格式' : 'Edge API格式';
        $('#apiTips').text(`自定义API: ${customAPIs[apiName].name} - 使用${formatStr}`);
    } else {
        $('#apiTips').text(tips[apiName] || '');
    }
    
    // 根据API类型调整界面
    if (apiName === 'oai-tts' || (customAPIs[apiName] && customAPIs[apiName].format === 'openai')) {
        $('#instructionsContainer').show();
        $('#formatContainer').show();
        $('#rateContainer, #pitchContainer').hide();
        $('#pauseControls').hide(); // 隐藏停顿控制
    } else {
        $('#instructionsContainer').hide();
        $('#formatContainer').hide();
        $('#rateContainer, #pitchContainer').show();
        $('#pauseControls').show(); // 显示停顿控制
    }
    
    // 更新字符限制提示文本
    updateCharCountText();
}

function updateSliderLabel(sliderId, labelId) {
    const slider = $(`#${sliderId}`);
    const label = $(`#${labelId}`);
    label.text(slider.val());
    
    slider.off('input').on('input', function() {
        label.text(this.value);
    });
}

function canMakeRequest() {
    if (isGenerating) {
        showError('请等待当前语音生成完成');
        return false;
    }
    return true;
}

async function generateVoice(isPreview) {
    const apiName = $('#api').val();
    const apiUrl = API_CONFIG[apiName].url;
    const text = $('#text').val().trim();
    const currentSpeakerText = $('#speaker option:selected').text();
    const currentSpeakerId = $('#speaker').val();
    
    if (!text) {
        showError('请输入要转换的文本');
        return;
    }

    if (isPreview) {
        const previewText = text.substring(0, 20);
        try {
            const blob = await makeRequest(apiUrl, true, previewText, '', currentSpeakerId);
            if (blob) {
                if (currentAudioURL) URL.revokeObjectURL(currentAudioURL);
                currentAudioURL = URL.createObjectURL(blob);
                $('#result').show();
                $('#audio').attr('src', currentAudioURL);
                $('#download').attr('href', currentAudioURL);
            }
        } catch (error) {
            showError('试听失败：' + error.message);
        }
        return;
    }

    if (!canMakeRequest()) {
        return;
    }

    // 设置生成状态
    isGenerating = true;
    $('#generateButton').prop('disabled', true);
    $('#previewButton').prop('disabled', true);

    // 处理长文本
    const segments = splitText(text);
    requestCounter++;
    const currentRequestId = requestCounter;
    
    if (segments.length > 1) {
        showLoading(`正在生成#${currentRequestId}请求的 1/${segments.length} 段语音...`);
        generateVoiceForLongText(segments, currentRequestId, currentSpeakerText, currentSpeakerId, apiUrl, apiName).then(finalBlob => {
            if (finalBlob) {
                if (currentAudioURL) {
                    URL.revokeObjectURL(currentAudioURL);
                }
                currentAudioURL = URL.createObjectURL(finalBlob);
                $('#result').show();
                $('#audio').attr('src', currentAudioURL);
                $('#download').attr('href', currentAudioURL);
            }
        }).finally(() => {
            hideLoading();
            isGenerating = false;
            $('#generateButton').prop('disabled', false);
            $('#previewButton').prop('disabled', false);
        });
    } else {
        showLoading(`正在生成#${currentRequestId}请求的语音...`);
        const requestInfo = `#${currentRequestId}(1/1)`;
        makeRequest(apiUrl, false, text, requestInfo, currentSpeakerId)
            .then(blob => {
                if (blob) {
                    const timestamp = new Date().toLocaleTimeString();
                    const cleanText = text.replace(/<break\s+time=["'](\d+(?:\.\d+)?[ms]s?)["']\s*\/>/g, '');
                    const shortenedText = cleanText.length > 7 ? cleanText.substring(0, 7) + '...' : cleanText;
                    addHistoryItem(timestamp, currentSpeakerText, shortenedText, blob, requestInfo);
                }
            })
            .finally(() => {
                hideLoading();
                isGenerating = false;
                $('#generateButton').prop('disabled', false);
                $('#previewButton').prop('disabled', false);
            });
    }
}

// 原有的TTS功能函数
function escapeXml(text) {
    const ssmlTags = [];
    let tempText = text.replace(/<break\s+time=["'](\d+(?:\.\d+)?[ms]s?)["']\s*\/>/g, (match) => {
        ssmlTags.push(match);
        return `__SSML_TAG_${ssmlTags.length - 1}__`;
    });

    tempText = tempText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    tempText = tempText.replace(/__SSML_TAG_(\d+)__/g, (_, index) => ssmlTags[parseInt(index)]);
    return tempText;
}

async function makeRequest(url, isPreview, text, requestInfo = '', speakerId = null) {
    try {
        const apiName = $('#api').val();
        const customApi = customAPIs[apiName];
        const isCustomApi = !!customApi;
        const apiFormat = customApi ? (customApi.format || 'openai') : (apiName === 'oai-tts' ? 'openai' : 'edge');
        
        if (apiFormat === 'openai') {
            text = text.replace(/<break\s+time=["'](\d+(?:\.\d+)?[ms]s?)["']\s*\/>/g, '');
        } else {
            text = escapeXml(text);
        }
        
        const headers = {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json'
        };
        
        const voice = speakerId || $('#speaker').val();
        let requestBody;
        
        if (apiFormat === 'openai') {
            const instructions = $('#instructions').val().trim();
            const format = $('#audioFormat').val();
            
            requestBody = {
                model: voice,
                input: text,
                voice: isCustomApi ? "alloy" : voice,
                response_format: format
            };
            
            if (instructions) {
                requestBody.instructions = instructions;
            }
            
            if (isCustomApi && customApi.apiKey) {
                headers['Authorization'] = `Bearer ${customApi.apiKey}`;
            }
        } else {
            requestBody = {
                text: text,
                voice: voice,
                rate: parseInt($('#rate').val()),
                pitch: parseInt($('#pitch').val()),
                preview: isPreview
            };
            
            if (isCustomApi && customApi.apiKey) {
                if (customApi.apiKey.toLowerCase().startsWith('x-api-key:')) {
                    const keyValue = customApi.apiKey.substring('x-api-key:'.length).trim();
                    headers['x-api-key'] = keyValue;
                } else {
                    headers['Authorization'] = `Bearer ${customApi.apiKey}`;
                }
            }
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`服务器响应错误: ${response.status} - ${errorText || response.statusText}`);
        }

        const blob = await response.blob();
        
        if (!blob.type.includes('audio/') || blob.size === 0) {
            throw new Error('无效的音频文件');
        }

        if (!isPreview) {
            currentAudioURL = URL.createObjectURL(blob);
            $('#result').show();
            $('#audio').attr('src', currentAudioURL);
            $('#download')
                .removeClass('disabled')
                .attr('href', currentAudioURL);
                
            const audioFormat = (apiFormat === 'openai') ? $('#audioFormat').val() : 'mp3';
            $('#download').attr('download', `voice.${audioFormat}`);
        }

        return blob;
    } catch (error) {
        console.error('请求错误:', error);
        showError(error.message);
        throw error;
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
}

function showLoading(message) {
    let loadingToast = $('.toast-loading');
    if (loadingToast.length) {
        loadingToast.find('.progress-bar').css('width', '0%');
        return;
    }

    const toast = $(`
        <div class="toast toast-loading">
            <div class="toast-body toast-info">
                <div class="text-center">
                    <i class="fas fa-spinner fa-spin"></i>
                    <div class="loading-message mt-2">${message}</div>
                    <div class="progress mt-2">
                        <div class="progress-bar" role="progressbar" style="width: 0%"></div>
                    </div>
                </div>
            </div>
        </div>
    `);
    
    $('.toast-container').append(toast);
    setTimeout(() => toast.addClass('show'), 100);
}

function hideLoading() {
    const loadingToast = $('.toast-loading');
    loadingToast.removeClass('show');
    setTimeout(() => loadingToast.remove(), 300);
}

function updateLoadingProgress(progress, message) {
    const loadingToast = $('.toast-loading');
    if (loadingToast.length) {
        loadingToast.find('.progress-bar').css('width', `${progress}%`);
        loadingToast.find('.loading-message').text(message);
    }
}

// 其他必要的函数
function initializeAudioPlayer() {
    const audio = document.getElementById('audio');
    if (audio) {
        audio.style.borderRadius = '12px';
        audio.style.width = '100%';
        audio.style.marginTop = '20px';
    }
    
    $('#download')
        .addClass('disabled')
        .attr('href', '#');
    $('#audio').attr('src', '');
}

function insertPause() {
    const seconds = parseFloat($('#pauseSeconds').val());
    if (isNaN(seconds) || seconds < 0.01 || seconds > 100) {
        showError('请输入0.01到100之间的数字');
        return;
    }
    
    const textarea = $('#text')[0];
    const cursorPos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, cursorPos);
    const textAfter = textarea.value.substring(textarea.selectionEnd);
    
    const pauseTag = `<break time="${seconds}s"/>`;
    textarea.value = textBefore + pauseTag + textAfter;
    
    const newPos = cursorPos + pauseTag.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.focus();
}

function updateCharCountText() {
    const currentLength = getTextLength($('#text').val());
    const apiName = $('#api').val();
    const { maxTotal } = getApiLimits(apiName);
    const percentage = Math.round((currentLength / maxTotal) * 100);
    
    $('#charCount').text(`${percentage}% (${currentLength}/${maxTotal}单位)`);
    $('#text').attr('maxlength', maxTotal);
    
    if (currentLength > maxTotal) {
        const textarea = $('#text')[0];
        let text = textarea.value;
        while (getTextLength(text) > maxTotal && text.length > 0) {
            text = text.slice(0, -1);
        }
        textarea.value = text;
        $('#charCount').text(`100% (${getTextLength(text)}/${maxTotal}单位)`);
    }
}

function getTextLength(str) {
    let totalPauseTime = 0;
    const textWithoutTags = str.replace(/<break\s+time="(\d+(?:\.\d+)?)(m?s)"\s*\/>/g, (match, time, unit) => {
        const seconds = unit === 'ms' ? parseFloat(time) / 1000 : parseFloat(time);
        totalPauseTime += seconds;
        return '';
    });

    const textLength = textWithoutTags.split('').reduce((acc, char) => {
        return acc + (char.charCodeAt(0) > 127 ? 2 : 1);
    }, 0);

    const pauseLength = Math.round(totalPauseTime * 11);
    return textLength + pauseLength;
}

function getApiLimits(apiName) {
    if (apiName === 'oai-tts' || (customAPIs[apiName] && customAPIs[apiName].format === 'openai')) {
        return { maxSegment: 400, maxTotal: 2000 };
    } else {
        return { maxSegment: 5000, maxTotal: 100000 };
    }
}

function splitText(text) {
    const apiName = $('#api').val();
    const { maxSegment } = getApiLimits(apiName);
    const segments = [];
    let remainingText = text.trim();

    const punctuationGroups = [
        ['\n', '\r\n'],  
        ['。', '！', '？', '.', '!', '?'],
        ['；', ';'],
        ['，', '：', ',', ':'],
        ['、', '…', '―', '─', '-', '—', '–'],
        [' ', '\t', '　']
    ];

    while (remainingText.length > 0) {
        let splitIndex = remainingText.length;
        let currentLength = 0;
        let bestSplitIndex = -1;

        for (let i = 0; i < remainingText.length; i++) {
            currentLength += remainingText.charCodeAt(i) > 127 ? 2 : 1;
            
            if (currentLength > maxSegment) {
                splitIndex = i;
                for (let priority = 0; priority < punctuationGroups.length; priority++) {
                    let searchLength = 0;
                    for (let j = i; j >= 0 && searchLength <= 300; j--) {
                        searchLength += remainingText.charCodeAt(j) > 127 ? 2 : 1;
                        
                        if (punctuationGroups[priority].includes(remainingText[j])) {
                            bestSplitIndex = j;
                            break;
                        }
                    }
                    if (bestSplitIndex > -1) break;
                }
                break;
            }
        }

        if (bestSplitIndex > 0) {
            splitIndex = bestSplitIndex + 1;
        }

        segments.push(remainingText.substring(0, splitIndex));
        remainingText = remainingText.substring(splitIndex).trim();
    }

    return segments;
}

// 自定义API管理
function saveCustomAPI(e) {
    e.preventDefault();
    const name = $('#apiName').val().trim();
    const endpoint = $('#apiEndpoint').val().trim();
    if (!name || !endpoint) { 
        showError('API 名称和端点不能为空'); 
        return; 
    }
    
    const key = $('#apiKey').val().trim();
    const modelEndpoint = $('#modelEndpoint').val().trim();
    const format = $('#apiFormat').val();
    const manual = $('#manualSpeakers').val().split(',').map(s=>s.trim()).filter(Boolean);
    const id = editingApiId || ('custom-' + Date.now());
    
    customAPIs[id] = { 
        name, endpoint, apiKey:key, modelEndpoint, format, manual
    };
    
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
    API_CONFIG[id] = { 
        url:endpoint, isCustom:true, apiKey:key, format, manual
    };
    
    updateApiOptions();
    refreshSavedApisList();
    $('#customApiForm')[0].reset();
    editingApiId = null;
    showInfo(`自定义API ${editingApiId? '已更新':'已添加'}: ${name}`);
}

function refreshSavedApisList() {
    const listContainer = $('#savedApisList');
    listContainer.empty();
    
    if (Object.keys(customAPIs).length === 0) {
        listContainer.append('<div class="alert alert-light">没有保存的自定义API</div>');
        return;
    }
    
    Object.keys(customAPIs).forEach(apiId => {
        const api = customAPIs[apiId];
        const item = $(`
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <h6>${api.name}</h6>
                    <small class="text-muted">${api.endpoint}</small>
                </div>
                <button class="btn btn-sm btn-danger delete-api" data-api-id="${apiId}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `);
        
        listContainer.append(item);
    });
    
    $('.delete-api').on('click', function() {
        const apiId = $(this).data('api-id');
        if (confirm('确定要删除这个API吗？')) {
            delete customAPIs[apiId];
            delete API_CONFIG[apiId];
            localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
            updateApiOptions();
            refreshSavedApisList();
            showInfo('API已删除');
        }
    });
}

// 历史记录相关函数
const cachedAudio = new Map();

function addHistoryItem(timestamp, speaker, text, audioBlob, requestInfo = '') {
    const MAX_HISTORY = 50;
    const historyItems = $('#historyItems');
    
    if (historyItems.children().length >= MAX_HISTORY) {
        const oldestItem = historyItems.children().last();
        oldestItem.remove();
    }

    const audioURL = URL.createObjectURL(audioBlob);
    cachedAudio.set(audioURL, audioBlob);
    
    const cleanText = text.replace(/<break\s+time=["'](\d+(?:\.\d+)?[ms]s?)["']\s*\/>/g, '');
    
    const historyItem = $(`
        <div class="history-item list-group-item" style="opacity: 0;">
            <div class="d-flex justify-content-between align-items-center">
                <span class="text-truncate me-2" style="max-width: 70%;">
                    <strong class="text-primary">${requestInfo}</strong> 
                    ${timestamp} - <span class="text-primary">${speaker}</span> - ${cleanText}
                </span>
                <div class="btn-group flex-shrink-0">
                    <button class="btn btn-sm btn-outline-primary play-btn" data-url="${audioURL}">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-success" onclick="downloadAudio('${audioURL}')">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            </div>
        </div>
    `);
    
    historyItem.on('click', function(e) {
        if (!$(e.target).closest('.btn-group').length) {
            playAudio(audioURL);
            if (currentAudioURL) {
                URL.revokeObjectURL(currentAudioURL);
            }
            currentAudioURL = URL.createObjectURL(cachedAudio.get(audioURL));
            $('#result').show();
            $('#audio').attr('src', currentAudioURL);
            $('#download')
                .removeClass('disabled')
                .attr('href', currentAudioURL);
        }
    });
    
    historyItem.on('remove', () => {
        URL.revokeObjectURL(audioURL);
        cachedAudio.delete(audioURL);
    });
    
    historyItem.find('.play-btn').on('click', function(e) {
        e.stopPropagation();
        playAudio($(this).data('url'));
    });
    
    $('#historyItems').prepend(historyItem);
    setTimeout(() => historyItem.animate({ opacity: 1 }, 300), 50);
}

function playAudio(audioURL) {
    const audioElement = $('#audio')[0];
    const allPlayButtons = $('.play-btn');
    
    if (audioElement.src === audioURL && !audioElement.paused) {
        audioElement.pause();
        allPlayButtons.each(function() {
            if ($(this).data('url') === audioURL) {
                $(this).html('<i class="fas fa-play"></i>');
            }
        });
        return;
    }
    
    allPlayButtons.html('<i class="fas fa-play"></i>');
    
    audioElement.src = audioURL;
    audioElement.load();
    
    audioElement.play().then(() => {
        allPlayButtons.each(function() {
            if ($(this).data('url') === audioURL) {
                $(this).html('<i class="fas fa-pause"></i>');
            }
        });
    }).catch(error => {
        if (error.name !== 'AbortError') {
            console.error('播放失败:', error);
            showError('音频播放失败，请重试');
        }
    });
    
    audioElement.onended = function() {
        allPlayButtons.each(function() {
            if ($(this).data('url') === audioURL) {
                $(this).html('<i class="fas fa-play"></i>');
            }
        });
    };
}

function downloadAudio(audioURL) {
    const blob = cachedAudio.get(audioURL);
    if (blob) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'audio.mp3';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }
}

function clearHistory() {
    $('#historyItems .history-item').each(function() {
        $(this).remove();
    });
    
    cachedAudio.forEach((blob, url) => {
        URL.revokeObjectURL(url);
    });
    cachedAudio.clear();
    
    $('#historyItems').empty();
    alert("历史记录已清除！");
}

// 长文本处理
async function generateVoiceForLongText(segments, currentRequestId, currentSpeakerText, currentSpeakerId, apiUrl, apiName) {
    const results = [];
    const totalSegments = segments.length;
    
    const originalText = $('#text').val();
    const cleanText = originalText.replace(/<break\s+time=["'](\d+(?:\.\d+)?[ms]s?)["']\s*\/>/g, '');
    const shortenedText = cleanText.length > 7 ? cleanText.substring(0, 7) + '...' : cleanText;
    
    showLoading('');
    
    let hasSuccessfulSegment = false;
    const MAX_RETRIES = 3;

    for (let i = 0; i < segments.length; i++) {
        let retryCount = 0;
        let success = false;
        let lastError = null;

        while (retryCount < MAX_RETRIES && !success) {
            try {
                const progress = ((i + 1) / totalSegments * 100).toFixed(1);
                const retryInfo = retryCount > 0 ? `(重试 ${retryCount}/${MAX_RETRIES})` : '';
                updateLoadingProgress(
                    progress, 
                    `正在生成#${currentRequestId}请求的 ${i + 1}/${totalSegments} 段语音${retryInfo}...`
                );
                
                const requestInfo = `#${currentRequestId}(${i + 1}/${totalSegments})`;
                
                const blob = await makeRequest(
                    apiUrl, 
                    false, 
                    segments[i], 
                    requestInfo,
                    currentSpeakerId
                );
                
                if (blob) {
                    hasSuccessfulSegment = true;
                    success = true;
                    results.push(blob);
                    const timestamp = new Date().toLocaleTimeString();
                    const cleanSegmentText = segments[i].replace(/<break\s+time=["'](\d+(?:\.\d+)?[ms]s?)["']\s*\/>/g, '');
                    const shortenedSegmentText = cleanSegmentText.length > 7 ? cleanSegmentText.substring(0, 7) + '...' : cleanSegmentText;
                    const requestInfo = `#${currentRequestId}(${i + 1}/${totalSegments})`;
                    addHistoryItem(timestamp, currentSpeakerText, shortenedSegmentText, blob, requestInfo);
                }
            } catch (error) {
                lastError = error;
                retryCount++;
                
                if (retryCount < MAX_RETRIES) {
                    console.error(`分段 ${i + 1} 生成失败 (重试 ${retryCount}/${MAX_RETRIES}):`, error);
                    const waitTime = 3000 + (retryCount * 2000);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    showError(`第 ${i + 1}/${totalSegments} 段生成失败：${error.message}`);
                }
            }
        }

        if (!success) {
            console.error(`分段 ${i + 1} 在 ${MAX_RETRIES} 次尝试后仍然失败:`, lastError);
        }

        if (success && i < segments.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    hideLoading();

    if (results.length > 0) {
        const finalBlob = new Blob(results, { type: 'audio/mpeg' });
        const timestamp = new Date().toLocaleTimeString();
        const mergeRequestInfo = `#${currentRequestId}(合并)`;
        addHistoryItem(timestamp, currentSpeakerText, shortenedText, finalBlob, mergeRequestInfo);
        return finalBlob;
    }

    throw new Error('所有片段生成失败');
}

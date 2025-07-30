// 完全基于Edge TTS webui.html的Vue3实现
const { createApp } = Vue;

// 创建Vue应用实例
let ttsApp;

// 定义全局挂载函数
window.mountTtsApp = function() {
    if (!ttsApp) {
        ttsApp = createApp({
            data() {
                return {
                    title: 'AI语音助手 - TTS功能',
                    isLoading: false,
                    isStreaming: false,
                    audioSrc: '',
                    downloadUrl: '',
                    showDownloadBtn: false,
                    pauseTime: 1.0,
                    config: {
                        baseUrl: '/api',
                        apiKey: ''
                    },
                    form: {
                        inputText: '请在这里输入要转换的文本...',
                        voice: 'zh-CN-XiaoxiaoNeural',
                        speed: 1.0,
                        pitch: 1.0,
                        cleaning: {
                            removeMarkdown: true,
                            removeEmoji: true,
                            removeUrls: true,
                            removeLineBreaks: true,
                            removeCitation: true,
                            customKeywords: ''
                        }
                    },
                    status: {
                        show: false,
                        message: '',
                        type: 'info'
                    },
                    // 语音选项
                    voiceOptions: {
                        'zh-CN-XiaoxiaoNeural': '中文女声 (晓晓)',
                        'zh-CN-YunxiNeural': '中文男声 (云希)',
                        'zh-CN-YunyangNeural': '中文男声 (云扬)',
                        'zh-CN-XiaoyiNeural': '中文女声 (晓伊)',
                        'zh-CN-YunjianNeural': '中文男声 (云健)',
                        'zh-CN-XiaochenNeural': '中文女声 (晓辰)',
                        'zh-CN-XiaohanNeural': '中文女声 (晓涵)',
                        'zh-CN-XiaomengNeural': '中文女声 (晓梦)',
                        'zh-CN-XiaomoNeural': '中文女声 (晓墨)',
                        'zh-CN-XiaoqiuNeural': '中文女声 (晓秋)',
                        'zh-CN-XiaoruiNeural': '中文女声 (晓睿)',
                        'zh-CN-XiaoshuangNeural': '中文女声 (晓双)',
                        'zh-CN-XiaoxuanNeural': '中文女声 (晓萱)',
                        'zh-CN-XiaoyanNeural': '中文女声 (晓颜)',
                        'zh-CN-XiaoyouNeural': '中文女声 (晓悠)',
                        'zh-CN-XiaozhenNeural': '中文女声 (晓甄)',
                        'zh-CN-YunfengNeural': '中文男声 (云枫)',
                        'zh-CN-YunhaoNeural': '中文男声 (云皓)',
                        'zh-CN-YunxiaNeural': '中文男声 (云夏)',
                        'zh-CN-YunyeNeural': '中文男声 (云野)',
                        'zh-CN-YunzeNeural': '中文男声 (云泽)',
                        'en-US-JennyNeural': '英文女声 (Jenny)',
                        'en-US-GuyNeural': '英文男声 (Guy)',
                        'en-US-AriaNeural': '英文女声 (Aria)',
                        'en-US-DavisNeural': '英文男声 (Davis)'
                    }
                }
            },
            computed: {
                charCount() {
                    return this.form.inputText.length;
                },
                speedDisplay() {
                    return this.form.speed.toFixed(2);
                },
                pitchDisplay() {
                    return this.form.pitch.toFixed(2);
                }
            },
            methods: {
                loadConfig() {
                    try {
                        const saved = localStorage.getItem('tts_config');
                        if (saved) {
                            this.config = { ...this.config, ...JSON.parse(saved) };
                        }
                    } catch (e) {
                        console.warn('Failed to load config from localStorage:', e);
                    }
                },
                saveConfig() {
                    try {
                        localStorage.setItem('tts_config', JSON.stringify(this.config));
                    } catch (e) {
                        console.warn('Failed to save config to localStorage:', e);
                    }
                },
                loadForm() {
                    try {
                        const saved = localStorage.getItem('tts_form');
                        if (saved) {
                            this.form = { ...this.form, ...JSON.parse(saved) };
                        }
                    } catch (e) {
                        console.warn('Failed to load form from localStorage:', e);
                    }
                },
                saveForm() {
                    try {
                        localStorage.setItem('tts_form', JSON.stringify(this.form));
                    } catch (e) {
                        console.warn('Failed to save form to localStorage:', e);
                    }
                },
                clearText() {
                    this.form.inputText = '';
                    this.saveForm();
                },
                downloadAudio() {
                    if (this.downloadUrl) {
                        const link = document.createElement('a');
                        link.href = this.downloadUrl;
                        const timeString = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                        link.download = `tts-audio-${timeString}.mp3`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }
                },
                updateStatus(message, type = 'info') {
                    this.status = {
                        show: true,
                        message,
                        type
                    };
                },
                hideStatus() {
                    this.status.show = false;
                },
                getRequestBody() {
                    return {
                        voice: this.form.voice,
                        text: this.form.inputText.trim(),
                        rate: Math.round((this.form.speed - 1) * 100),
                        pitch: Math.round((this.form.pitch - 1) * 100),
                        format: 'mp3'
                    };
                },
                async generateSpeech(isPreview = false) {
                    const text = this.form.inputText.trim();
                    
                    if (!text) {
                        this.updateStatus('请输入要转换的文本', 'error');
                        return;
                    }

                    const requestBody = this.getRequestBody();
                    if (isPreview) {
                        requestBody.text = text.substring(0, 50) + (text.length > 50 ? '...' : '');
                    }

                    this.isLoading = true;
                    this.audioSrc = '';
                    this.showDownloadBtn = false;
                    
                    if (this.downloadUrl) {
                        URL.revokeObjectURL(this.downloadUrl);
                        this.downloadUrl = '';
                    }
                    
                    this.updateStatus('正在生成语音...', 'info');

                    try {
                        const response = await fetch('/api/tts', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(requestBody),
                        });

                        if (!response.ok) {
                            const errorData = await response.text();
                            throw new Error(`HTTP ${response.status}: ${errorData}`);
                        }

                        const blob = await response.blob();
                        this.audioSrc = URL.createObjectURL(blob);
                        this.downloadUrl = this.audioSrc;
                        this.showDownloadBtn = true;
                        
                        this.updateStatus(isPreview ? '试听生成成功' : '语音生成成功', 'success');

                        // 自动播放
                        this.$nextTick(() => {
                            const audio = this.$refs.audioPlayer;
                            if (audio) {
                                audio.play().catch(e => 
                                    console.warn('Autoplay was prevented:', e)
                                );
                            }
                        });

                    } catch (error) {
                        console.error('Error generating speech:', error);
                        this.updateStatus('生成语音失败: ' + error.message, 'error');
                    } finally {
                        this.isLoading = false;
                    }
                },
                onAudioLoadStart() {
                    console.log('Audio loading started');
                },
                onAudioCanPlay() {
                    console.log('Audio can play');
                },
                insertPause() {
                    const textarea = this.$refs.textareaRef;
                    if (!textarea) return;
                    
                    if (!this.pauseTime || this.pauseTime <= 0 || this.pauseTime > 100) {
                        this.updateStatus('停顿时间必须在 0.01 到 100 秒之间', 'error');
                        return;
                    }

                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const breakTag = `<break time="${this.pauseTime}s"/>`;

                    const newText = this.form.inputText.slice(0, start) +
                        breakTag +
                        this.form.inputText.slice(end);

                    this.form.inputText = newText;

                    this.$nextTick(() => {
                        const newPos = start + breakTag.length;
                        textarea.focus();
                        textarea.setSelectionRange(newPos, newPos);
                    });
                },
                updateVoiceSelector() {
                    // 这个方法在Vue3中不需要，因为我们使用v-for绑定
                    console.log('Voice selector updated via Vue binding');
                }
            },
            mounted() {
                this.loadConfig();
                this.loadForm();
                console.log('TTS Vue应用已挂载');
            },
            beforeUnmount() {
                if (this.audioSrc) {
                    URL.revokeObjectURL(this.audioSrc);
                }
                if (this.downloadUrl && this.downloadUrl !== this.audioSrc) {
                    URL.revokeObjectURL(this.downloadUrl);
                }
            }
        });
        
        // 挂载Vue应用
        ttsApp = ttsApp.mount('#ttsMode');
        console.log('TTS Vue应用已初始化');
    } else {
        console.log('TTS Vue应用已存在，无需重新初始化');
    }
};

// 全局变量和函数
let currentMode = 'chat';
let chatHistory = [];
let currentAudio = null;
let isPlaying = false;

// AI设置默认值
const DEFAULT_AI_SETTINGS = {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    systemPrompt: '你是一个友善、有趣的AI语音助手。请用简洁、自然的语言回复用户，保持对话轻松愉快。回复长度控制在100字以内，除非用户特别要求详细解释。',
    temperature: 0.7,
    maxTokens: 150
};

// 初始化应用
function initializeApp() {
    console.log('正在初始化应用...');
    
    try {
        // 初始化基本功能
        showMode('chat');
        setupEventListeners();
        loadAISettings();
        loadChatHistory();
        updateVoiceSelectors();
        initializeSliders();
        
        console.log('应用初始化完成');
    } catch (error) {
        console.error('应用初始化失败:', error);
        showError('应用初始化失败: ' + error.message);
    }
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
        
        $('#saveAiSettings').off('click').on('click', saveAISettings);
        $('#clearChatBtn').off('click').on('click', clearChat);
        
        // TTS相关事件 - 使用Vue实例的方法
        $('#generateButton').off('click').on('click', function() {
            if (window.ttsVueApp) {
                window.ttsVueApp.generateSpeech(false);
            }
        });
        
        $('#previewButton').off('click').on('click', function() {
            if (window.ttsVueApp) {
                window.ttsVueApp.generateSpeech(true);
            }
        });
        
        // 插入停顿按钮
        $('#insertPause').off('click').on('click', function() {
            if (window.ttsVueApp) {
                window.ttsVueApp.insertPause();
            }
        });
        
        // 字符计数更新
        $('#text').off('input').on('input', updateCharCount);
        
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
            
            // 初始化TTS Vue应用
            if (window.mountTtsApp) {
                window.mountTtsApp();
            }
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
        addMessageToChat('user', message);
        input.val('');
        
        chatHistory.push({ role: 'user', content: message });
        
        const loadingId = addLoadingMessage();
        
        const aiResponse = await callAIAPI(message);
        
        removeLoadingMessage(loadingId);
        
        addMessageToChat('ai', aiResponse);
        
        chatHistory.push({ role: 'assistant', content: aiResponse });
        
        saveChatHistory();
        
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
        const voice = $('#chatSpeaker').val();
        const rate = parseInt($('#chatRate').val()) || 0;
        const pitch = parseInt($('#chatPitch').val()) || 0;
        
        if (!voice) {
            showWarning('请先选择语音');
            return;
        }
        
        const requestBody = {
            text: text,
            voice: voice,
            rate: rate,
            pitch: pitch,
            format: 'mp3'
        };
        
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const audioBlob = await response.blob();
        await playAudioBlob(audioBlob);
        
    } catch (error) {
        console.error('语音朗读失败:', error);
        showError('语音朗读失败: ' + error.message);
    }
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
        
        messageElement.find('.speak-btn').off('click').on('click', function() {
            const text = $(this).data('text');
            speakText(text);
        });
        
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
function updateVoiceSelectors() {
    const voiceOptions = {
        'zh-CN-XiaoxiaoNeural': '晓晓 (女声)',
        'zh-CN-YunxiNeural': '云希 (男声)',
        'zh-CN-YunyangNeural': '云扬 (男声)',
        'zh-CN-XiaoyiNeural': '晓伊 (女声)',
        'zh-CN-YunjianNeural': '云健 (男声)',
        'zh-CN-XiaochenNeural': '晓辰 (女声)',
        'zh-CN-XiaohanNeural': '晓涵 (女声)',
        'zh-CN-XiaomengNeural': '晓梦 (女声)',
        'zh-CN-XiaomoNeural': '晓墨 (女声)',
        'zh-CN-XiaoqiuNeural': '晓秋 (女声)',
        'zh-CN-XiaoruiNeural': '晓睿 (女声)',
        'zh-CN-XiaoshuangNeural': '晓双 (女声)',
        'zh-CN-XiaoxuanNeural': '晓萱 (女声)',
        'zh-CN-XiaoyanNeural': '晓颜 (女声)',
        'zh-CN-XiaoyouNeural': '晓悠 (女声)',
        'zh-CN-XiaozhenNeural': '晓甄 (女声)',
        'zh-CN-YunfengNeural': '云枫 (男声)',
        'zh-CN-YunhaoNeural': '云皓 (男声)',
        'zh-CN-YunxiaNeural': '云夏 (男声)',
        'zh-CN-YunyeNeural': '云野 (男声)',
        'zh-CN-YunzeNeural': '云泽 (男声)'
    };
    
    const selectors = ['#chatSpeaker', '#speaker'];
    selectors.forEach(selector => {
        const select = $(selector);
        if (select.length) {
            select.empty();
            Object.entries(voiceOptions).forEach(([key, value]) => {
                select.append(new Option(value, key));
            });
        }
    });
}

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
            chatHistory.forEach(msg => {
                if (msg.role === 'user') {
                    addMessageToChat('user', msg.content);
                } else if (msg.role === 'assistant') {
                    addMessageToChat('ai', msg.content);
                }
            });
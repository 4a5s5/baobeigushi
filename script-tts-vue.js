// 基于Vue3的TTS实现 - 参考edgetts-cloudflare-workers-webui
const { createApp } = Vue;

createApp({
  data() {
    return {
      title: 'AI语音助手 - TTS服务',
      isLoading: false,
      isStreaming: false,
      audioSrc: '',
      downloadUrl: '',
      showDownloadBtn: false,
      pauseTime: 1.0,
      
      // TTS配置
      config: {
        baseUrl: window.location.origin, // 使用当前域名
        apiKey: ''
      },
      
      // TTS表单数据
      form: {
        inputText: '你好，这是一个语音测试。请输入你想要转换为语音的文本内容。',
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
      
      // 状态管理
      status: {
        show: false,
        message: '',
        type: 'info'
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
    // 配置管理
    loadConfig() {
      try {
        const saved = localStorage.getItem('tts_config');
        if (saved) {
          this.config = { ...this.config, ...JSON.parse(saved) };
        }
      } catch (e) {
        console.warn('Failed to load config:', e);
      }
    },
    
    saveConfig() {
      try {
        localStorage.setItem('tts_config', JSON.stringify(this.config));
      } catch (e) {
        console.warn('Failed to save config:', e);
      }
    },
    
    // 表单管理
    loadForm() {
      try {
        const saved = localStorage.getItem('tts_form');
        if (saved) {
          this.form = { ...this.form, ...JSON.parse(saved) };
        }
      } catch (e) {
        console.warn('Failed to load form:', e);
      }
    },
    
    saveForm() {
      try {
        localStorage.setItem('tts_form', JSON.stringify(this.form));
      } catch (e) {
        console.warn('Failed to save form:', e);
      }
    },
    
    // 文本操作
    clearText() {
      this.form.inputText = '';
      this.saveForm();
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
      this.saveForm();

      // 保持光标位置
      this.$nextTick(() => {
        const newPos = start + breakTag.length;
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      });
    },
    
    // 状态管理
    updateStatus(message, type = 'info') {
      this.status = {
        show: true,
        message,
        type
      };
      
      // 自动隐藏成功和信息消息
      if (type === 'success' || type === 'info') {
        setTimeout(() => {
          this.status.show = false;
        }, 3000);
      }
    },
    
    hideStatus() {
      this.status.show = false;
    },
    
    // 构建请求体 - 兼容Edge TTS API格式
    getRequestBody() {
      return {
        input: this.form.inputText.trim(),
        voice: this.form.voice,
        speed: this.form.speed,
        pitch: this.form.pitch,
        cleaning_options: {
          remove_markdown: this.form.cleaning.removeMarkdown,
          remove_emoji: this.form.cleaning.removeEmoji,
          remove_urls: this.form.cleaning.removeUrls,
          remove_line_breaks: this.form.cleaning.removeLineBreaks,
          remove_citation_numbers: this.form.cleaning.removeCitation,
          custom_keywords: this.form.cleaning.customKeywords,
        },
      };
    },
    
    // 主要的语音生成函数
    async generateSpeech(isStream) {
      const text = this.form.inputText.trim();
      
      if (!text) {
        this.updateStatus('请输入要转换的文本', 'error');
        return;
      }

      const requestBody = this.getRequestBody();
      requestBody.stream = isStream;

      this.isLoading = true;
      this.isStreaming = isStream;
      this.audioSrc = '';
      this.showDownloadBtn = false;
      
      // 清理之前的下载链接
      if (this.downloadUrl) {
        URL.revokeObjectURL(this.downloadUrl);
        this.downloadUrl = '';
      }
      
      this.updateStatus('正在生成语音...', 'info');

      try {
        if (isStream) {
          await this.playStreamWithMSE(requestBody);
        } else {
          await this.playStandard(requestBody);
        }
      } catch (error) {
        console.error('Error generating speech:', error);
        this.updateStatus('语音生成失败: ' + error.message, 'error');
      } finally {
        this.isLoading = false;
        this.isStreaming = false;
      }
    },
    
    // 标准模式播放
    async playStandard(body) {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
        } catch (e) {
          // 如果无法解析JSON，使用默认错误消息
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      this.audioSrc = URL.createObjectURL(blob);
      this.downloadUrl = this.audioSrc;
      this.showDownloadBtn = true;
      this.updateStatus('语音生成成功！', 'success');

      // 自动播放
      this.$nextTick(() => {
        if (this.$refs.audioPlayer) {
          this.$refs.audioPlayer.play().catch(e =>
            console.warn('自动播放被阻止:', e)
          );
        }
      });
    },
    
    // 流式播放 - 使用Media Source Extensions
    async playStreamWithMSE(body) {
      const mediaSource = new MediaSource();
      this.audioSrc = URL.createObjectURL(mediaSource);
      
      // 用于收集音频数据的数组
      const audioChunks = [];

      return new Promise((resolve, reject) => {
        mediaSource.addEventListener('sourceopen', async () => {
          const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');

          try {
            const response = await fetch('/api/tts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(body),
            });

            if (!response.ok) {
              let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
              try {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorMessage;
              } catch (e) {
                // 使用默认错误消息
              }
              throw new Error(errorMessage);
            }

            this.updateStatus('开始流式播放...', 'info');

            // 自动播放
            this.$nextTick(() => {
              if (this.$refs.audioPlayer) {
                this.$refs.audioPlayer.play().catch(e =>
                  console.warn('自动播放被阻止:', e)
                );
              }
            });

            const reader = response.body.getReader();

            const pump = async () => {
              try {
                const { done, value } = await reader.read();

                if (done) {
                  if (mediaSource.readyState === 'open' && !sourceBuffer.updating) {
                    mediaSource.endOfStream();
                  }

                  // 创建完整的音频文件用于下载
                  const completeAudioBlob = new Blob(audioChunks, { type: 'audio/mpeg' });
                  this.downloadUrl = URL.createObjectURL(completeAudioBlob);
                  this.showDownloadBtn = true;

                  this.updateStatus('流式播放完成！', 'success');
                  resolve();
                  return;
                }

                // 收集音频数据块
                audioChunks.push(value.slice());

                // 等待sourceBuffer准备好
                if (sourceBuffer.updating) {
                  await new Promise(resolve =>
                    sourceBuffer.addEventListener('updateend', resolve, { once: true })
                  );
                }

                sourceBuffer.appendBuffer(value);
                this.updateStatus('正在流式播放...', 'info');
                
                // 继续读取下一块数据
                pump();
              } catch (error) {
                console.error('流式播放错误:', error);
                reject(error);
              }
            };

            // 开始读取数据
            pump();
            
          } catch (error) {
            console.error('流式播放初始化错误:', error);
            this.updateStatus('流式播放失败: ' + error.message, 'error');
            if (mediaSource.readyState === 'open') {
              try {
                mediaSource.endOfStream();
              } catch (e) {
                console.warn('无法结束媒体源:', e);
              }
            }
            reject(error);
          }
        }, { once: true });
        
        // 处理媒体源错误
        mediaSource.addEventListener('error', (e) => {
          console.error('MediaSource错误:', e);
          reject(new Error('媒体源播放失败'));
        });
      });
    },
    
    // 下载音频文件
    downloadAudio() {
      if (this.downloadUrl) {
        const link = document.createElement('a');
        link.href = this.downloadUrl;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        link.download = `tts-audio-${timestamp}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.updateStatus('音频文件下载开始', 'success');
      }
    },
    
    // 音频事件处理
    onAudioLoadStart() {
      console.log('音频开始加载');
    },
    
    onAudioCanPlay() {
      console.log('音频可以播放');
    },
    
    onAudioError(event) {
      console.error('音频播放错误:', event);
      this.updateStatus('音频播放失败', 'error');
    },
    
    onAudioEnded() {
      console.log('音频播放结束');
      this.updateStatus('播放完成', 'success');
    }
  },
  
  mounted() {
    console.log('TTS Vue应用已挂载');
    this.loadConfig();
    this.loadForm();
  },
  
  beforeUnmount() {
    // 清理URL对象，避免内存泄漏
    if (this.audioSrc && this.audioSrc.startsWith('blob:')) {
      URL.revokeObjectURL(this.audioSrc);
    }
    if (this.downloadUrl && this.downloadUrl !== this.audioSrc && this.downloadUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.downloadUrl);
    }
  }
}).mount('#tts-app');
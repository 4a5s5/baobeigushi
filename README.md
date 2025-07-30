# 宝贝故事 - AI语音助手

一个集成了AI对话和文本转语音(TTS)功能的Web应用，支持多种中英文语音，可调节语速和音调，提供即时试听和下载功能。

## 功能特点

- **双模式切换**：对话模式和TTS模式自由切换
- **多语音支持**：内置多种中英文语音选择
- **参数调节**：可调节语速和音调
- **文本处理**：支持插入停顿标签
- **音频播放**：集成音频播放器和下载功能
- **试听功能**：支持前50字符试听
- **状态提示**：实时显示生成状态

## 技术栈

- 前端：HTML5, CSS3, JavaScript, Vue3
- 后端：Cloudflare Pages Functions
- API：Edge TTS API

## 部署指南

### 部署到Cloudflare Pages

1. 在Cloudflare Dashboard中创建一个新的Pages项目
2. 连接你的GitHub仓库
3. 配置构建设置：
   - 构建命令：留空
   - 构建输出目录：留空（使用根目录）
4. 添加环境变量（可选）：
   - `REQUIRE_PASSWORD`: 设置为 "true" 启用密码保护
   - `PASSWORD`: 设置访问密码

### 本地开发

1. 安装Wrangler CLI：
   ```bash
   npm install -g wrangler
   ```

2. 本地运行：
   ```bash
   wrangler pages dev
   ```

## 文件结构

```
/
├── index.html              # 主HTML文件
├── style.css               # 样式表
├── script-mode-switch.js   # 模式切换脚本
├── script-edge-tts.js      # Edge TTS Vue3实现
├── script-optimized.js     # 优化版主脚本（备用）
├── wrangler.toml           # Cloudflare配置文件
├── _routes.json            # 路由配置
├── functions/              # Cloudflare Functions
│   ├── _worker.js          # 主Worker入口
│   └── api/                # API处理模块
│       ├── tts.js          # TTS API
│       ├── voices.js       # 语音列表API
│       ├── check-password.js  # 密码检查API
│       └── verify-password.js # 密码验证API
└── .gitignore              # Git忽略文件
```

## API接口

### TTS生成接口

- **URL**: `/api/tts`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "text": "要转换的文本",
    "voice": "zh-CN-XiaoxiaoNeural",
    "rate": 0,
    "pitch": 0,
    "format": "mp3"
  }
  ```
- **响应**: 音频文件 (audio/mpeg)

### 语音列表接口

- **URL**: `/api/voices`
- **方法**: `GET`
- **响应**: 语音列表JSON

## 许可证

MIT License

## 作者

Zwei
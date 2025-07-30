# AI语音助手 - Cloudflare Pages 部署指南

这是一个集成了AI对话和文本转语音功能的Web应用，支持部署到Cloudflare Pages。

## 功能特性

- 🤖 AI智能对话
- 🎵 文本转语音 (TTS)
- 🎛️ 语音参数调节（语速、语调）
- 📱 响应式设计
- 🔒 密码保护功能

## Cloudflare Pages 部署步骤

### 1. 准备工作

确保你的项目包含以下文件结构：
```
├── index.html          # 主页面
├── style.css           # 样式文件
├── script.js           # 前端脚本
├── functions/          # Cloudflare Pages Functions
│   └── api/
│       ├── tts.js      # TTS API
│       ├── voices.js   # 语音列表API
│       ├── check-password.js  # 密码检查API
│       └── verify-password.js # 密码验证API
├── _routes.json        # 路由配置
├── _headers            # HTTP头配置
└── wrangler.toml       # Cloudflare配置
```

### 2. 部署到 Cloudflare Pages

1. **连接 GitHub 仓库**
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - 进入 Pages 页面
   - 点击 "Create a project"
   - 选择 "Connect to Git"
   - 选择你的 GitHub 仓库

2. **配置构建设置**
   - Framework preset: `None`
   - Build command: 留空
   - Build output directory: `/`
   - Root directory: `/`

3. **环境变量设置**（可选）
   - 在 Pages 项目设置中添加环境变量
   - `PASSWORD`: 设置访问密码（如果需要密码保护）

### 3. 验证部署

部署完成后，访问你的 Cloudflare Pages 域名，应该能看到：
- 主页面正常加载
- AI对话功能正常
- TTS功能正常
- API接口响应正常

### 4. 常见问题排查

**问题1: 页面无法加载**
- 检查 `_routes.json` 配置是否正确
- 确认 `functions` 目录结构正确

**问题2: API 请求失败**
- 检查 Functions 代码中的 CORS 设置
- 确认 API 路径配置正确

**问题3: 密码功能不工作**
- 检查环境变量 `PASSWORD` 是否设置
- 确认密码验证 API 正常工作

## 本地开发

如果需要本地开发，可以使用 Wrangler CLI：

```bash
# 安装 Wrangler
npm install -g wrangler

# 本地开发服务器
wrangler pages dev .

# 部署到 Cloudflare Pages
wrangler pages publish .
```

## 技术栈

- **前端**: HTML5, CSS3, JavaScript, Bootstrap
- **后端**: Cloudflare Pages Functions
- **TTS服务**: Microsoft Azure Speech Services
- **部署平台**: Cloudflare Pages

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
// Cloudflare Worker 主入口文件
// 处理所有请求并路由到相应的API处理程序

import { handleTTS } from './api/tts.js';
import { handleVoices } from './api/voices.js';
import { handleCheckPassword } from './api/check-password.js';
import { handleVerifyPassword } from './api/verify-password.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // API路由处理
    if (path.startsWith('/api/')) {
      // TTS API
      if (path === '/api/tts') {
        return await handleTTS(request, env);
      }
      
      // 语音列表API
      if (path === '/api/voices') {
        return await handleVoices(request, env);
      }
      
      // 密码检查API
      if (path === '/api/check-password') {
        return await handleCheckPassword(request, env);
      }
      
      // 密码验证API
      if (path === '/api/verify-password') {
        return await handleVerifyPassword(request, env);
      }
      
      // 未知API路径
      return new Response('API不存在', { status: 404 });
    }
    
    // 静态文件处理
    return await handleStaticFile(request, env, ctx);
  }
};

// 处理静态文件
async function handleStaticFile(request, env, ctx) {
  try {
    // 使用Cloudflare Pages的静态文件服务
    // 这里不需要额外的代码，Cloudflare Pages会自动处理静态文件
    return fetch(request);
  } catch (error) {
    console.error('静态文件处理错误:', error);
    return new Response('文件不存在', { status: 404 });
  }
}

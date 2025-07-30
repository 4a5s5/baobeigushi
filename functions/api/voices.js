// 语音列表API处理模块

export async function handleVoices(request, env) {
  try {
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }
    
    // 返回预定义的语音列表
    const voices = {
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
    };
    
    return new Response(JSON.stringify(voices), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('语音列表API错误:', error);
    return new Response(`获取语音列表失败: ${error.message}`, { status: 500 });
  }
}

// 处理CORS预检请求
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
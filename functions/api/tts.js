// TTS API处理模块

export async function handleTTS(request, env) {
  try {
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }
    
    if (request.method !== 'POST') {
      return new Response('只支持POST请求', { status: 405 });
    }
    
    const data = await request.json();
    
    if (!data.text || !data.voice) {
      return new Response('缺少必要参数', { status: 400 });
    }
    
    // 构建Edge TTS请求
    const edgeURL = 'https://api.edge-tts.cn/v1/synthesize';
    const edgeParams = new URLSearchParams({
      text: data.text,
      voice: data.voice,
      rate: data.rate || 0,
      pitch: data.pitch || 0,
      format: data.format || 'mp3'
    });
    
    const response = await fetch(`${edgeURL}?${edgeParams.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Edge TTS API返回错误: ${response.status}`);
    }
    
    const audioBlob = await response.blob();
    
    return new Response(audioBlob, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('TTS API错误:', error);
    return new Response(`TTS生成失败: ${error.message}`, { status: 500 });
  }
}

// 处理CORS预检请求
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
// 密码验证API处理模块

export async function handleVerifyPassword(request, env) {
  try {
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }
    
    if (request.method !== 'POST') {
      return new Response('只支持POST请求', { status: 405 });
    }
    
    const data = await request.json();
    
    if (!data.password) {
      return new Response('缺少密码参数', { status: 400 });
    }
    
    // 验证密码
    const correctPassword = env.PASSWORD || '';
    const valid = data.password === correctPassword;
    
    return new Response(JSON.stringify({ valid }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('密码验证API错误:', error);
    return new Response(`密码验证失败: ${error.message}`, { status: 500 });
  }
}

// 处理CORS预检请求
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
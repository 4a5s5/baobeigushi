// 密码检查API处理模块

export async function handleCheckPassword(request, env) {
  try {
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }
    
    // 检查是否需要密码
    const requirePassword = env.REQUIRE_PASSWORD === 'true';
    
    return new Response(JSON.stringify({ requirePassword }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('密码检查API错误:', error);
    return new Response(`密码检查失败: ${error.message}`, { status: 500 });
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
export async function onRequest(context) {
  const { request } = context;
  
  // 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-auth-token',
      },
    });
  }
  
  // 只允许 GET 请求
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
  
  try {
    const url = new URL(request.url);
    const localeFilter = (url.searchParams.get('l') || "").toLowerCase();
    const format = url.searchParams.get('f');
    
    let voices = await voiceList();
    if (localeFilter) {
      voices = voices.filter(item => item.Locale.toLowerCase().includes(localeFilter));
    }
    
    if (format === "0") {
      const formattedVoices = voices.map(item => formatVoiceItem(item));
      return new Response(formattedVoices.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          'Access-Control-Allow-Origin': '*',
        },
      });
    } else if (format === "1") {
      const voiceMap = Object.fromEntries(voices.map(item => [item.ShortName, item.LocalName]));
      return new Response(JSON.stringify(voiceMap), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } else {
      return new Response(JSON.stringify(voices), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Failed to fetch voices" }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

function formatVoiceItem(item) {
  return `
- !!org.nobody.multitts.tts.speaker.Speaker
  avatar: ''
  code: ${item.ShortName}
  desc: ''
  extendUI: ''
  gender: ${item.Gender === "Female" ? "0" : "1"}
  name: ${item.LocalName}
  note: 'wpm: ${item.WordsPerMinute || ""}'
  param: ''
  sampleRate: ${item.SampleRateHertz || "24000"}
  speed: 1.5
  type: 1
  volume: 1`;
}

async function voiceList() {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "X-Ms-Useragent": "SpeechStudio/2021.05.001",
    "Content-Type": "application/json",
    "Origin": "https://azure.microsoft.com",
    "Referer": "https://azure.microsoft.com"
  };
  
  const response = await fetch("https://eastus.api.speech.microsoft.com/cognitiveservices/voices/list", {
    headers: headers
  });
  
  if (!response.ok) {
    throw new Error(`获取语音列表失败，状态码 ${response.status}`);
  }
  
  return await response.json();
}
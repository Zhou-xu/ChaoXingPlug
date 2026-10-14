
//获取用户apikey与requestUrl

const userInfo: { requestUrl: string; apikey: string } = {
  requestUrl: '',
  apikey: '',
};

// ⚠️ 启动时必须从 storage 读取已有配置，否则 userInfo.requestUrl 是空字符串
browser.storage.local.get(['requestUrl', 'apikey']).then((result: any) => {
  userInfo.requestUrl = result.requestUrl || '';
  userInfo.apikey = result.apikey || '';
  console.log('【启动】初始化 userInfo:', userInfo);
});

export default defineBackground(() => {

  // 监听消息
  browser.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
    //content 题目答题
    if (request.type === 'seedQuestion') {
      console.log('【请求】收到题目查询，问题数量:', request.Question?.length);
      console.log('【请求】当前 userInfo.requestUrl =', JSON.stringify(userInfo.requestUrl));
      console.log('【请求】当前 userInfo.apikey =', JSON.stringify(userInfo.apikey));
      seedQuestion(userInfo, request.Question).then((a) => {
        console.log('【返回】seedQuestion 返回结果:', a);
        sendResponse(a);
      }).catch((error) => {
        console.error('【错误】seedQuestion 异常:', error);
        sendResponse({ type: 'responseQuestion', error: error.message });
      });
      return true;  // 异步响应，告诉浏览器等待 sendResponse
    }
    //content 存储vue界面用户apikey与requestUrl
    else if (request.type === 'userInfo') {
      console.log('【存储】保存 requestUrl:', request.url);
      console.log('【存储】保存 apikey:', request.apiKey);
      storeUserInfo(request.url, request.apiKey)
      .then(async () => {
        const result: any = await browser.storage.local.get(['requestUrl', 'apikey']);
        userInfo.requestUrl = result.requestUrl || '';
        userInfo.apikey = result.apikey || '';
        sendResponse({ status: "success" });
        console.log('【存储】更新后 userInfo:', userInfo);
      }).catch((error) => { console.log("储存用户信息失败：" + error.message); });
      return true;  // 异步响应，告诉浏览器等待 sendResponse
    }
  });

});

//TODO:AI接口调用
//发送请求获取问题
const seedQuestion = async (info: { requestUrl: string; apikey: string }, questions: string[]): Promise<any> => {
  // 1. 空值检查
  if (!info.requestUrl || !info.apikey) {
    throw new Error('【配置缺失】请先在弹窗中配置 requestUrl 和 apikey，然后重新触发答题');
  }
  // 2. URL 格式检查——必须是 http/https 开头
  if (!info.requestUrl.startsWith('http://') && !info.requestUrl.startsWith('https://')) {
    throw new Error('【URL 格式错误】requestUrl 必须以 http:// 或 https:// 开头，当前值: ' + info.requestUrl);
  }
  console.log('【API】调用地址:', info.requestUrl);
  console.log('【API】请求问题:', questions);
  // 遍历每个问题，发送请求(防止单对话文字长度超过最大限制)
  let result: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    console.log('当前处理问题:', i+1, '问题:', questions[i]);
    const response = await fetch(info.requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': info.apikey
      },
      body: JSON.stringify({
        model: 'glm-4.6v',
        messages: [
          {
            role: 'user',
            content: '请严格按以下格式回答本题：\n' +
                '答案：<选项字母>\n' +
                '解析：<不超过50字>'
          },
            {
              role: 'user',
              content: questions[i]
            }
        ]
      })
    });
    console.log('【API】HTTP 状态码:', response.status, response.statusText);
    const text = await response.text();
    console.log('响应:', text);
    result.push("问题" + (i + 1) + "：" + JSON.parse(text).choices[0].message.content);
  }


  // 4. 读取响应内容
  const responseText = result.join('\n');
  console.log('【API】原始响应内容前500字符:', responseText.slice(0, 500));

  // 5. 尝试解析为 JSON
  try {
    return result;
  } catch {
    // 如果不是 JSON（例如返回了 HTML 或 JS 文件），直接返回文本
    return { type: 'responseQuestion', error: 'API 未返回 JSON，响应内容: ' + responseText.slice(0, 200) };
  }
};

//存储用户apikey与requestUrl
async function storeUserInfo(requestUrl: string, apikey: string,) {
  if(requestUrl !== null) {
    await browser.storage.local.set({"requestUrl":requestUrl});
  }
  if(apikey !== null) {
    await browser.storage.local.set({"apikey":apikey});
  }
}
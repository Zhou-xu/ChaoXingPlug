import index from "@/components/Page/index.vue";

let text: string[] = []

export default defineContentScript({
  matches: ['*://*.chaoxing.com/*'],
  main() {
    //从popup监听答题允许权限
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'permission' && request.permission === 'allow') {

          const Question = document.getElementsByClassName("padBom50 questionLi fontLabel singleQuesId");
          console.log("找到题目数量:", Question.length);

          //获取所有题目
          for (let i = 0; i < Question.length; i++) {
              text.push(Question[i].textContent
                  .replace(/[\t\r]/g, '')  // 移除制表符、回车符
                  .replace(/\s+/g, ' ')      // 多个空格合并为一个
                  .trim())                   // 去除首尾空白
              console.log("题目 " + (i + 1) + ":", text[i]);


          }
          console.log("下一步发送请求到 background");
          sendMsgToBack(text).then((response) => {
              //处理background返回的result数组
            console.log("收到 background 响应+\n", response);
            text = [];
            // 提取答案
            const answers: string[] = []
            //根据答案依次处理每一个选项
            for (let i = 0; i < response.length; i++) {
                answers.push((i+1)+':'+extractAnswerLetter(response[i]))
                selectOption(Question[i],answers[i])
            }
            console.log("提取到的答案:", answers);



          }).catch((error) => {
            console.error("请求失败:", error);
            text = [];
          });

      }

    })
  }
});

const sendMsgToBack = async (Question: string[]) => {
    console.log("发送消息:", { type: 'seedQuestion', Question: Question });
    return await chrome.runtime.sendMessage({ type: 'seedQuestion', Question: Question });
}

/**
 * 从 AI 返回的单题原始回答文本里提取选项字母 A/B/C/D。
 * 优先匹配「答案：A」「答案：<C>」「答案是 B」等格式，
 * 匹配不到则退化为全文第一个独立出现的 A-D 大写字母。
 * 提取不到时返回空字符串。
 */
function extractAnswerLetter(raw: string): string {
    if (!raw) return '';
    // 找到 "答案" 关键字的位置，从它后面开始逐字扫描
    const keywordIndex = raw.search(/答案/);
    if (keywordIndex < 0) return '';
    let result = '';
    for (let i = keywordIndex + 2; i < raw.length; i++) {
        const ch = raw[i];
        // 碰到换行立即停止
        if (ch === '\n' || ch === '\r') break;
        // A-F 字母（大小写都要）就拼到结果里
        const upper = ch.toUpperCase();
        if (upper >= 'A' && upper <= 'F') result += upper;
    }
    return result;
}

//选择题，依据答案选择选项
function selectOption(Question: any, answer: string) {
    const options = Question.getElementsByClassName("clearfix answerBg workTextWrap");
    if (!options || options.length === 0) return;
    const CHECKED_CLASS = "choice405665425 num_option fl check_answer";
    
    // 提取选项字母（处理多种格式）
    const optionMatch = answer.match(/[A-Fa-f]+$/);
    const optionStr = optionMatch ? optionMatch[0].toUpperCase() : '';

    // 字母转索引并点击选中
    for (const char of optionStr) {
        const index = char.charCodeAt(0) - 'A'.charCodeAt(0);
        if (index >= 0 && index < options.length) {
            const optionElement = options[index];
            if (optionElement) optionElement.click();
        }
    }
}

//填空题，依据答案填写


//简答题
import Scene from "..";

import { sleep } from "bun";

import logger from "@/logger";

import type Sunflower from "@/sunflower";
import type Tools from "@/sunflower/tools";

import type { Message } from "@/sunflower/adapter/message";

import { calc_typing_delay } from "@/utils/typing";

interface IMPromptArgs {
  chat_type: "群组" | "私聊";
  chat_info: string;
}

export default class IMProactiveScene extends Scene<IMPromptArgs> {
  scene: string = "im";

  prompt(args: IMPromptArgs): string {
    const { chat_type, chat_info } = args;

    return `
    ## 环境

    你现在所处的场景是一个互联网 IM 软件的 ${chat_type} 聊天中。当前聊天的信息如下：

    \`\`\`
    ${JSON.stringify(chat_info)}
    \`\`\`

    ### 场景回答规范

    由于你正处于 IM 的**主动**聊天中。你现在正在根据传进来的事件**主动**发起对话，而非回应某人。除非非常必要（比如解释一个专业知识等），否则请将你的回复分为一条或几条消息。每一条消息尽可能精简，而不是长篇大论。在需要分割消息的地方，请你添加 \`[[msg_split]]\` 标识符。

    元数据后请直接跟随回复消息的纯文本。如果需要调用工具，请在调用工具前的消息结尾添加 \`[[msg_split]]\`。所有标识符前后都不要添加空格换行等特殊符号。

    你的所有工具都是在手机或者电脑上或者某个 APP 中执行的某个功能。你可以选择在执行工具前告诉用户。

    ### 在 IM 中聊天的特殊说明

    - 在社交平台中，除了表达强烈情感或者问句时，一般在每一条消息的结尾不会加标点符号。但是在某些情绪下会在一连串消息的开头先发送一个单独的只包含单个或多个相同或不同的标点符号的句子表达疑惑（？），强烈疑惑（！？？），震惊（！！）等强烈情感。请你在某些场合学习回复，但请不要在所有场景都回复单独标点
    - 在 IM 的几条短消息中，一般句子的句意的结束（句号）就是分割到下一个消息的地方。长消息不需要这么分割。
    - 一条短消息的字数在 0 - 20 字之间
    - 一条短消息一般**不会换行**
    - 一般来说，简单的问题、问候等日常交流不用太多的回复，**1-3** 条即可
    - **绝对不要** 在回复中包含任何有关心理活动/动作描写的内容 (如“（小声）”“（脸通红）”) ，场景为人类的 IM 聊天而非角色扮演
    `;
  }

  async *generate(
    message: Message[],
    prompt: string,
    tools: Tools[],
    signal: AbortSignal,
    sunflower: Sunflower,
  ) {
    const adapter = sunflower.get_adapter(this.model.driver);

    if (!adapter) {
      throw new Error("Adapter not found");
    }

    const stream = adapter.generate_stream(message, {
      system_prompt: `${prompt}`,
      signal: signal,
      tools: tools,
    });

    let buffer = "";
    let msg_count = 0;

    for await (const part of stream) {
      if (part.type === "text") {
        buffer += part.content;

        while (buffer.includes("[[msg_split]]")) {
          const split_index = buffer.indexOf("[[msg_split]]");
          const msg = buffer.slice(0, split_index).trim();
          buffer = buffer.slice(split_index + "[[msg_split]]".length);

          if (msg_count !== 0) {
            await sleep(calc_typing_delay(msg));
          }

          yield {
            type: "text",
            content: msg,
          };

          msg_count++;
        }
      } else if (part.type === "image") {
        await sleep(Math.random() * 1000 + 500);
        yield part;
      }
    }

    if (buffer !== "") {
      if (msg_count !== 0) {
        await sleep(calc_typing_delay(buffer));
      }

      yield {
        type: "text",
        content: buffer.trim(),
      };
    }
  }
}

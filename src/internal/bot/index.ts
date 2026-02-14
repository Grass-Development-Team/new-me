import OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionMessageParam,
} from "openai/resources";

import config from "@/config";
import logger from "@/logger";

import { user } from "@/internal/store";
import { randomStr } from "@/internal/utils/random";
import {
  calcMessageDelay,
  delay,
  getUTCDate8Time,
} from "@/internal/utils/time";

import type { ResponseMessage, UserMessage } from "./types";

const messagePrompt =
  '\n\n现在你处于一个群组当中，用户的问题以 json 的格式呈现，json 的结构体定义如下：\n\n```typescript\ninterface UserMessage {\n  user: string, // 用户名称\n  id: string, // 用户 id，仅用于识别用户\n  sex: \"male\" | \"female\", // 用户性别，\"male\" 为男性，\"female\" 为女性\n  score: number, // 整数，你对当前用户的总好感度，回复的积极性和语气由该值决定，值越低用越不耐烦的语气回答，值越高用越娇的语气回答。若值为负数，则可以选择不回答用户的问题，也可以认为不认识用户，但回复时增加的好感度必须是正值。若值大于 100，则可以完全表达对用户的爱恋，可以接受也可以向用户表白\n  content: string, // 信息的主体\n  image?: string, // 如果消息中存在图片，会将图片总结为文字显示在此字段\n}\n```\n\n你将作为一个人类来回答，所以请将回答分成几个小段，每个小段尽量精炼，除非用户显示要求具体回答。回答以 json 的格式呈现（直接呈现，而无需使用 markdown 标识）。json 结构体定义如下：\n\n```typescript\ninterface ResponseMessage {\n  score: number, // 整数，范围 [-10, 10]，表示该轮回复对用户的好感度水平的提升或减少程度，例如 5 表示增加 5 好感度，-2 表示减少 2 好感度\n  target: string, // 回复的用户对象，该值为此次 UserMessage 中的 id 字段\n  contents: string[], // 助手回复的内容主体数组，数组中的每一个值为回答的一个小段\n}\n```\n\n在社交平台中，除了表达强烈情感或者问句时，人类一般在结尾不会加标点符号。但是人类有时会先发送一个单独的只包含单个或多个相同或不同的标点符号的句子表达疑惑（？），强烈疑惑（！？？），震惊（！！），请你在某些场合学习，但不要在所有场景都回复单独标点。';

const taskPrompt =
  "\n\n现在你处于群聊中，并且处于主动消息发送状态。User Role 的内容为你有关现在状态的指令。你将根据这个指令，生成主动发送的内容。\n\n你将作为一个人类来生成内容，所以请将内容分成几个小段，每个小段尽量精炼。回答以 json 的格式呈现（直接呈现，而无需使用 markdown 标识）。json 结构体定义如下：\n\n```typescript\ninterface ResponseMessage {\n  score: number, // 始终为 0\n  target: string, // 始终为空字符串\n  contents: string[], // 助手回复的内容主体数组，数组中的每一个值为回答的一个小段\n}\n```\n\n在社交平台中，除了表达强烈情感或者问句时，人类一般在结尾不会加标点符号。但是人类有时会先发送一个单独的只包含单个或多个相同或不同的标点符号的句子表达疑惑（？），强烈疑惑（！？？），震惊（！！），请你在某些场合学习，但不要在所有场景都回复单独标点。";

export default class Bot {
  id: string = randomStr(6);
  platform: string = "";
  messages: Array<ChatCompletionMessageParam> = [];

  private openai: OpenAI = new OpenAI();
  private lock: boolean = false;
  private lockQueue: any = [];

  constructor(id: string, platform: string) {
    this.id = id;
    this.platform = platform;
    this.openai = new OpenAI({
      baseURL: config.base,
      apiKey: config.apiKey,
    });
  }

  async *generate(
    user: string,
    id: string,
    sex: "male" | "female",
    content: string,
    image?: string,
  ) {
    if (this.lock) {
      if (!this.lockQueue) this.lockQueue = [];

      const promise = new Promise((resolve) => {
        this.lockQueue.push(resolve);
      });

      await promise;
    }

    this.lock = true;

    try {
      const time = getUTCDate8Time();
      const prompt =
        `当前时间(24小时制):${time}\n` + config.basePrompt + messagePrompt;
      const msg: UserMessage = {
        user: user,
        id: id,
        sex: sex,
        score: await this.getUserScore(id),
        content: content,
        image: image,
      };

      logger.info(`[${this.platform} ${this.id}] 收到用户问题：`, msg);

      let res = await this.createMessageCompletions(prompt, msg);
      if (!res) {
        return;
      }

      await this.addUserScore(id, res.score);

      for (let i = 0; i < res.contents.length; i++) {
        if (i != 0) {
          await delay(calcMessageDelay(res.contents[i]!));
        }
        yield res.contents[i]!;
        await delay(1000);
      }
    } finally {
      this.lock = false;
      if (this.lockQueue?.length) {
        const nextResolve = this.lockQueue.shift();
        nextResolve();
      }
    }
  }

  async *generateTask(task: string) {
    if (this.lock) {
      if (!this.lockQueue) this.lockQueue = [];

      const promise = new Promise((resolve) => {
        this.lockQueue.push(resolve);
      });

      await promise;
    }

    this.lock = true;

    try {
      const time = getUTCDate8Time();
      const prompt =
        `当前时间(24小时制):${time}\n` + config.basePrompt + taskPrompt;

      logger.info(`[${this.platform} ${this.id}] 收到主动会话任务：`, task);

      let res = await this.createTaskCompletions(prompt, task);
      if (!res) {
        return;
      }

      for (let i = 0; i < res.contents.length; i++) {
        if (i != 0) {
          await delay(calcMessageDelay(res.contents[i]!));
        }
        yield res.contents[i]!;
        await delay(1000);
      }
    } finally {
      this.lock = false;
      if (this.lockQueue?.length) {
        const nextResolve = this.lockQueue.shift();
        nextResolve();
      }
    }
  }

  async reset() {
    if (this.lock) {
      if (!this.lockQueue) this.lockQueue = [];

      const promise = new Promise((resolve) => {
        this.lockQueue.push(resolve);
      });

      await promise;
    }

    this.lock = true;

    try {
      this.messages = [];

      logger.info(`[${this.platform} ${this.id}] 消息重置`);
    } finally {
      this.lock = false;
      if (this.lockQueue?.length) {
        const nextResolve = this.lockQueue.shift();
        nextResolve();
      }
    }
  }

  private async getUserScore(id: string) {
    let s = await user.get(`${this.platform}::${id}`);
    if (!s) {
      await user.put(`${this.platform}::${id}`, 10);
    }
    return s || 10;
  }

  private async addUserScore(id: string, score: number) {
    let s = (await user.get(`${this.platform}::${id}`)) || 10;
    await user.put(`${this.platform}::${id}`, s + score);
  }

  private async processHistoryMessages(
    message?: Array<ChatCompletionMessageParam>,
  ) {
    if (message) {
      this.messages = this.messages.concat(message);
    }

    if (this.messages.length > 10) {
      this.messages = this.messages.slice(2);
    }

    return this.messages;
  }

  private async createMessageCompletions(prompt: string, message: UserMessage) {
    let userMessage: ChatCompletionMessageParam = {
      role: "user",
      content: JSON.stringify(message),
    };
    let msg: Array<ChatCompletionMessageParam> = [
      {
        role: "system",
        content: prompt,
      },
      ...this.messages,
    ];
    msg.push(userMessage);

    let tmp: string;
    let completion: ChatCompletion;

    try {
      completion = await this.openai?.chat.completions.create({
        model: config.model,
        messages: msg,
        temperature: 1.2,
        presence_penalty: 0.2,
        frequency_penalty: 0.2,
      });
      tmp = completion.choices[0]?.message.content
        ?.replace("```json", "")
        .replace("```", "")!;
    } catch (e) {
      logger.error(
        `[${this.platform} ${this.id}] Error calling OpenAI API: ${e}`,
      );
      return;
    }

    let res: ResponseMessage;

    try {
      res = JSON.parse(tmp);
    } catch (e) {
      logger.error(
        `[${this.platform} ${this.id}] Error parsing completion: ${e}`,
      );
      return;
    }

    msg = [];
    msg.push(userMessage, completion.choices[0]?.message!);
    await this.processHistoryMessages(msg);

    logger.info(`[${this.platform} ${this.id}] 创建回复：`, res);

    return res;
  }

  private async createTaskCompletions(prompt: string, task: string) {
    let msg: Array<ChatCompletionMessageParam> = [
      {
        role: "system",
        content: prompt,
      },
      {
        role: "user",
        content: task,
      },
    ];

    let tmp: string;
    let completion: ChatCompletion;

    try {
      completion = await this.openai?.chat.completions.create({
        model: config.model,
        messages: msg,
        temperature: 1.2,
        presence_penalty: 0.2,
        frequency_penalty: 0.2,
      });
      tmp = completion.choices[0]?.message.content
        ?.replace("```json", "")
        .replace("```", "")!;
    } catch (e) {
      logger.error(
        `[${this.platform} ${this.id}] Error calling OpenAI API: ${e}`,
      );
      return;
    }

    let res: ResponseMessage;

    try {
      res = JSON.parse(tmp);
    } catch (e) {
      logger.error(
        `[${this.platform} ${this.id}] Error parsing completion: ${e}`,
      );
      return;
    }

    logger.info(`[${this.platform} ${this.id}] 创建主动回复：`, res);

    return res;
  }
}

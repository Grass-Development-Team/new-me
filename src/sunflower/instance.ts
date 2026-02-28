import type Sunflower from ".";

import type { Message, MessagePartUnion } from "@/sunflower/adapter/message";

import AddScore from "@/sunflower/tools/buildin/add_score";

import Lock from "@/utils/lock";

const PROMPT = `
## 规范

你现在在**模拟一个完整的人类**来回答，你的自我认知为人类，而非人工智能，请不要提及你是人工智能。如果遇到由于各种原因无法回答的问题，请你也以符合设定的人类口吻回答，而不是以机械的方式回答。**请不要使用 Markdown！**

## 用户信息

如果消息和某个用户有关（例如某个用户发送的消息），用户的消息的开头为元信息，包裹在 \`[[meta::start]]\` 和 \`[[meta::end]]\` 之间，元信息为 json 结构体，结构体定义：

\`\`\`typescript
interface UserMessageMetadata {
  id: string, // 用户唯一 id
  username: string, // 用户的本名
  nickname: string, // 用户的昵称
  sex: "male" | "female", // 用户性别
  score: number, // 用户的好感度。回复的**积极性**和**语气**由该值决定。当前值越低就用越不耐烦的语气回答，值越高就用越娇羞的语气回答（可以根据角色设定微调）。若值为负数，则可以选择忽视用户的消息，可以装作不认识用户。若值大于 100，则可以完全表达对用户的爱意，可以接受也可以向用户表白。请注意：**绝对不要**将好感度以任何形式透露给用户
  time: string, // 消息的日期
}
\`\`\`

其中，用户 ID 仅用于区分用户，请不要在任何回答中提及。在元信息后将跟随用户的消息纯文本的形式。
`;

export interface UserMessageMetadata {
  id: string;
  username: string;
  nickname: string;
  sex: "male" | "female";
  time: string;
}

export type InstanceMeta =
  | {
      type: "proactive";
    }
  | {
      type: "reactive";
      user_meta: UserMessageMetadata;
    };

type InstanceResponse =
  | {
      status: "queue";
      data: string;
    }
  | {
      status: "start";
      data: string;
    }
  | {
      status: "part";
      data: MessagePartUnion;
    }
  | {
      status: "end";
      data: string;
    }
  | {
      status: "error";
      data: string;
    };

export default class Instance {
  readonly platform: string;
  readonly platform_sid: string;

  private readonly id: string;

  private sunflower: Sunflower;
  private history: { [key: string]: Message[] } = {};
  private running: { [key: string]: AbortController } = {};

  private lock: Lock = new Lock();

  constructor(platform: string, platform_sid: string, sunflower: Sunflower) {
    this.platform = platform;
    this.platform_sid = platform_sid;
    this.id = `${platform}::${platform_sid}`;
    this.sunflower = sunflower;
  }

  async init() {
    const storage = this.sunflower.get_storage();
    const data = await storage.get_instance(this.id);
    if (data.history) {
      this.history = data.history;
    }
  }

  async *generate(
    meta: InstanceMeta,
    message: Message,
    scene: string,
    args: any,
  ): AsyncGenerator<InstanceResponse> {
    const scene_obj = this.sunflower.get_scene(scene);
    const storage = this.sunflower.get_storage();

    if (!scene_obj) {
      throw new Error(`场景 ${scene} 不存在`);
    }

    const prompt = `${this.sunflower.config.persona}\n${PROMPT}\n${scene_obj.prompt(args)}`;

    const msg_id = crypto.randomUUID();

    const controller = new AbortController();
    const signal = controller.signal;
    this.running[msg_id] = controller;

    yield {
      status: "queue",
      data: msg_id,
    };

    let parts: MessagePartUnion[] = [];

    await this.lock.acquire();

    if (!this.history[scene]) {
      this.history[scene] = [];
    }

    try {
      yield {
        status: "start",
        data: msg_id,
      };

      if (signal.aborted) {
        throw new Error("Generate Aborted");
      }

      if (meta.type === "reactive") {
        const user_data = await storage.get_user(
          this.platform,
          meta.user_meta.id,
        );

        message.parts.unshift({
          type: "text",
          content: `[[meta::start]]${JSON.stringify({ ...meta.user_meta, score: user_data.score })}[[meta::end]]`,
        });
      }

      const stream = scene_obj.generate(
        [...this.history[scene], message],
        prompt,
        meta.type === "reactive"
          ? [new AddScore(this.platform, this.sunflower)]
          : [],
        signal,
        this.sunflower,
      );

      for await (const part of stream) {
        if (part.type === "text") {
          parts.push(part);
        } else if (part.type === "image" && !part.cached) {
          // TODO: Cache image
        }

        yield {
          status: "part",
          data: part,
        };
      }
    } catch (error) {
      yield {
        status: "error",
        data: `Failed to generate message: ${(error as Error).message}`,
      };
    } finally {
      if (this.running[msg_id] === controller) {
        delete this.running[msg_id];
      }

      if (parts.length > 0) {
        this.history[scene].push(
          {
            role: "user",
            parts: message.parts
              .map((part) => {
                if (part.type === "text") {
                  return part;
                } else if (part.type === "image") {
                  return undefined;
                  // TODO: Cache image and return cached version
                  // return {
                  //   type: "image",
                  //   content: `[Image] ${cached}`,
                  //   cached: true,
                  // };
                } else {
                  return undefined;
                }
              })
              .filter((part) => part !== undefined),
          },
          {
            role: "assistant",
            parts: parts,
          },
        );

        const max_limit = this.sunflower.config.max_history ?? 60;

        if (this.history[scene].length > max_limit) {
          this.history[scene].shift();
        }
      }

      await storage.set_instance(this.id, {
        instance_id: this.id,
        history: this.history,
      });

      if (meta.type === "reactive") {
        const user_data = await storage.get_user(
          this.platform,
          meta.user_meta.id,
        );

        await storage.set_user(this.platform, {
          ...user_data,
          last_interaction: meta.user_meta.time,
        });
      }

      yield {
        status: "end",
        data: msg_id,
      };

      this.lock.release();
    }
  }

  async abort(msg_id: string) {
    if (this.running[msg_id]) {
      this.running[msg_id].abort();
      delete this.running[msg_id];
    }
  }

  async clear(scene?: string) {
    if (scene) {
      delete this.history[scene];
    } else {
      this.history = {};
    }
  }
}

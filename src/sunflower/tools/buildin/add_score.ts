import Tools, { type ToolParameters } from "..";

import type Sunflower from "@/sunflower";
import logger from "@/logger";

export default class AddScore extends Tools {
  name: string = "add_score";
  description: string =
    "该工具用于在用户的好感度上增加或减少一定的分数。在主动聊天的会话中（存在用户元数据）都应该执行一次该工具，哪怕添加和减少的好感度为 0。在使用该工具前后请不要告知用户，也不要在任何时候以任何形式透露用户的好感度分数。";
  parameters = {
    score: {
      type: "NUMBER",
      description:
        "需要增加或减少的分数，范围在 [-10, 10] 之间。如果用户的好感度小于 -20，则范围在 [0, 10] 之间。若用户的好感度大于 120，则范围在 [-5, 0] 之间。",
    },
    target: {
      type: "STRING",
      description: "表示需要增加或减少好感度的目标对象 ID。",
    },
  };
  required = ["score", "target"];

  private platform: string;
  private sunflower: Sunflower;

  constructor(platform: string, sunflower: Sunflower) {
    super();
    this.platform = platform;
    this.sunflower = sunflower;
  }

  async call(args: ToolParameters): Promise<string> {
    const { score, target } = args;

    if (typeof score !== "number" || score < -10 || score > 10) {
      return "参数 score 必须是一个数字，且范围在 [-10, 10] 之间";
    }

    if (typeof target !== "string" || target.trim() === "") {
      return "参数 target 必须是一个非空字符串";
    }

    const storage = this.sunflower.get_storage();

    const user_data = await storage.get_user(this.platform, target);

    await storage.set_user(this.platform, {
      ...user_data,
      score: user_data.score + score,
    });

    logger.info({
      platform_id: this.platform,
      data: {
        message: `Updated score for user ${target}`,
        ...args,
        user: {
          ...user_data,
          score: user_data.score + score,
        },
      },
    });

    return `已成功将 ${target} 的好感度 ${score > 0 ? "增加" : "减少"} ${Math.abs(score)} 分`;
  }
}

import type { MessagePartUnion } from "@/sunflower/adapter/message";
import Tools, {
  type ToolContext,
  type ToolParameters,
  type ToolResponse,
} from "..";
import logger from "@/logger";

const PROMPT = `你是一个图片生成工具，用户会给你提供一段文字描述，你需要根据这个描述生成一张图片。请确保生成的图片与描述高度相关，并且尽可能详细地反映描述中的内容和情感。请注意，生成的图片应该符合用户的期望，因此在生成之前，请仔细分析用户的描述，理解他们的需求和意图。在生成过程中，如果遇到任何不明确或模糊的描述，请尝试通过上下文来推断用户的意图，以确保生成的图片能够满足他们的需求。请**只输出图片**，不要带有文字或其他提示内容。`;

export default class GenerateImageTool extends Tools {
  name: string = "generate_image";
  description: string =
    "该工具用于生成图片。请根据用户的需求，调用该工具生成相应的图片。提示词请使用英文（除非是要在图中显示非英文的文字），详细的描述镜头、场景、人物、风格等。在生成成功时返回“生成成功”，否则返回错误信息。该工具可能会有限额，请合理使用，避免频繁调用。一轮对话中最多只能使用一次该工具，哪怕是生成失败。";
  parameters?: ToolParameters = {
    description: {
      type: "STRING",
      description: "对需要生成的图片的详细描述，越详细越好",
    },
  };
  required?: string[] = ["description"];

  async call(args: any, ctx?: ToolContext): Promise<ToolResponse> {
    const { description } = args;

    if (typeof description !== "string" || description.trim() === "") {
      return { result: "参数 description 必须是一个非空字符串" };
    }

    logger.info({
      platform_id: ctx?.instance.platform,
      data: {
        message: "Calling generate_image tool",
        description,
      },
    });

    const sunflower = ctx?.sunflower;

    if (!sunflower) {
      logger.warn({
        message: "Tool context is missing sunflower instance",
      });

      return {
        result:
          "工具调用上下文缺少 sunflower 实例。这是程序内部问题，请勿再调用该工具。",
      };
    }

    const model = sunflower.config.models.image_gen_model;

    if (!model) {
      logger.warn({
        message: "No image_gen_model configured in sunflower config",
      });

      return {
        result:
          "配置中缺少 image_gen_model 模型信息，无法生成图片。这是程序内部问题，请勿再调用该工具。",
      };
    }

    const parts: MessagePartUnion[] = [];

    try {
      const adapter = sunflower.get_adapter(model.driver);

      if (!adapter) {
        logger.warn({
          message: `No adapter found for image_gen_model with driver ${model.driver}`,
        });

        return {
          result: `未找到 image_gen_model 模型 ${model.driver} 对应的适配器，无法生成图片。这是程序内部问题，请勿再调用该工具。`,
        };
      }

      const history = ctx.instance.get_history(ctx.scene) ?? [];

      const stream = adapter.generate_stream(
        [
          ...history,
          {
            role: "user",
            parts: [
              {
                type: "text",
                content: description,
              },
            ],
          },
        ],
        {
          model: model.model,
          system_prompt: PROMPT + sunflower.config.persona,
        },
      );

      for await (const part of stream) {
        if (part.type === "image") {
          parts.push(part);
        } else {
          logger.warn({
            message: "Received non-image part from image generation stream",
            part,
          });
        }
      }
    } catch (error) {
      logger.error({
        message: "Error occurred while generating image",
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        result: `生成图片时发生错误：${error instanceof Error ? error.message : String(error)}`,
      };
    }

    logger.info({
      platform_id: ctx?.instance.platform,
      data: {
        message: "Finished calling generate_image tool",
        description,
      },
    });

    return {
      result: "生成成功",
      parts: parts,
    };
  }
}

import logger from "@/logger";
import Tools, {
  type ToolContext,
  type ToolParameters,
  type ToolResponse,
} from "..";
import Gemini, { type GeminiConfig } from "@/sunflower/adapter/buildin/gemini";
import type AdapterConfig from "@/sunflower/adapter/config";

interface WebSearchArgs {
  query: string;
}

const SEARCH_SYSTEM_PROMPT = `你是一个实时 Web 检索工具。请根据用户查询返回准确、可验证、简洁的结果。

输出要求：
1. 先给结论摘要（1-3 句）。
2. 再给 3-5 条关键信息点。
3. 若结果包含可访问来源链接，最后追加“参考来源：”并列出链接（每行一个）。
4. 如果信息不确定或结果不足，明确说明“不确定”并解释原因。

注意：
- 仅返回检索结果，不要寒暄。
- 不要编造来源、数据或时间。`;

export default class WebSearch extends Tools<WebSearchArgs> {
  name: string = "web_search";
  description: string = "检索 Web 信息或者获取网页内容。";
  parameters?: ToolParameters = {
    query: {
      type: "string",
      description: "要搜索的关键词或者网页的 URL。",
    },
  };
  required?: string[] = ["query"];

  private models?: AdapterConfig<GeminiConfig>;

  constructor(models?: AdapterConfig<GeminiConfig>) {
    super();
    this.models = models;
  }

  async call(args: WebSearchArgs, ctx?: ToolContext): Promise<ToolResponse> {
    const query = args?.query;

    if (typeof query !== "string" || query.trim() === "") {
      return {
        result: "参数 query 必须是一个非空字符串",
      };
    }

    const model_config = this.resolve_model_config(ctx);

    if (!model_config) {
      logger.warn({
        message: "No Gemini adapter config found for web_search tool",
      });

      return {
        result: "未找到可用的 Gemini 配置，无法执行 web_search。",
      };
    }

    logger.info({
      platform_id: ctx?.instance.platform,
      data: {
        message: "Calling web_search tool",
        query: query,
      },
    });

    const adapter = new Gemini({
      ...model_config,
      extra_config: {
        ...(model_config.extra_config ?? {}),
        use_gemini_tools: true,
      },
    });

    try {
      const response = await adapter.generate(
        [
          {
            role: "user",
            parts: [
              {
                type: "text",
                content: query.trim(),
              },
            ],
          },
        ],
        {
          model: model_config.model,
          system_prompt: SEARCH_SYSTEM_PROMPT,
          signal: ctx?.signal,
        },
      );

      const texts = response.parts
        .filter((part) => part.type === "text")
        .map((part) => part.content.trim())
        .filter((part) => part.length > 0);

      const result =
        texts.join("\n").trim() || "未检索到可用结果，请尝试更具体的关键词。";

      logger.info({
        platform_id: ctx?.instance.platform,
        data: {
          message: "Finished calling web_search tool",
          query: query,
          result_length: result.length,
        },
      });

      return {
        result: result,
      };
    } catch (error) {
      logger.error({
        platform_id: ctx?.instance.platform,
        data: {
          message: "web_search tool failed",
          query: query,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      return {
        result: `检索失败：${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private resolve_model_config(
    ctx?: ToolContext,
  ): AdapterConfig<GeminiConfig> | undefined {
    if (this.models) {
      return this.models;
    }

    const sunflower = ctx?.sunflower;

    if (!sunflower) {
      return undefined;
    }

    const history_model = sunflower.config.models.history_model;
    const adapter = sunflower.get_adapter(history_model.driver);

    if (!(adapter instanceof Gemini)) {
      return undefined;
    }

    return adapter.config;
  }
}

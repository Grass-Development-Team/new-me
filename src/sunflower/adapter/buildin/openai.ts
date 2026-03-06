import logger from "@/logger";
import Adapter, { type GenerateOptions } from "..";
import type AdapterConfig from "../config";
import { type Message, type MessagePartUnion } from "../message";
import type Tools from "@/sunflower/tools";
import type { ToolParameters, ToolParameterSchema } from "@/sunflower/tools";

import OpenAIClient from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionContentPart,
  ChatCompletionContentPartText,
  ChatCompletionChunk,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";

type OpenAIToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export default class OpenAI extends Adapter {
  id: string = "openai";

  config: AdapterConfig;

  private client: OpenAIClient;

  constructor(config: AdapterConfig) {
    super();
    this.config = config;

    this.client = new OpenAIClient({
      apiKey: config.api_key,
      baseURL: config.base_url,
    });
  }

  async generate(
    message: Message[],
    options?: GenerateOptions,
  ): Promise<Message> {
    const messages = this.messages_to_content(message, options);

    const generate = async (
      current: ChatCompletionMessageParam[],
    ): Promise<Message> => {
      const tools = this.tools_to_openai_tools(options?.tools ?? []);
      const response = await this.client.chat.completions.create(
        {
          model: options?.model ?? this.config.model,
          messages: current,
          ...(tools && tools.length
            ? { tools, tool_choice: "auto" as const }
            : {}),
        },
        {
          signal: options?.signal,
        },
      );

      const choice = response.choices[0];
      if (!choice?.message) {
        throw new Error("No response generated");
      }

      const response_msg = choice.message;

      const final_res: Message = {
        role: "assistant",
        parts: [],
      };

      if (response_msg.content) {
        final_res.parts.push(
          ...this.content_to_message_parts(response_msg.content),
        );
      }

      if (response_msg.tool_calls?.length) {
        current.push(response_msg);

        const tool_messages: ChatCompletionMessageParam[] = [];
        const functions = options?.tools ?? [];

        for (const call of response_msg.tool_calls) {
          if (call.type !== "function") continue;

          const name = call.function.name;
          const args_str = call.function.arguments;
          let tool_response = "No tools found";

          const tool = functions.find((item) => item.name === name);
          if (tool) {
            try {
              const args = args_str ? JSON.parse(args_str) : {};
              const res = await tool.call(args, options?.tool_context);

              tool_response =
                typeof res?.result === "string"
                  ? res.result
                  : "Tool returned invalid response";

              if (Array.isArray(res?.parts)) {
                final_res.parts.push(...res.parts);
              }
            } catch (error) {
              logger.error({
                message: "Tool execution failed",
                tool: name,
                error: error instanceof Error ? error.message : String(error),
              });
              const error_message =
                error instanceof Error ? error.message : String(error);
              tool_response = `Tool ${name} failed: ${error_message}`;
            }
          } else {
            tool_response = `Tool ${name} not found`;
          }

          tool_messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: tool_response,
          });
        }

        current.push(...tool_messages);

        const next = await generate(current);
        final_res.parts.push(...next.parts);
      }

      return final_res;
    };

    return generate(messages);
  }

  async *generate_stream(
    message: Message[],
    options?: GenerateOptions,
  ): AsyncGenerator<MessagePartUnion> {
    const messages = this.messages_to_content(message, options);

    const generate_stream = async function* (
      client: OpenAIClient,
      adapter: OpenAI,
      current: ChatCompletionMessageParam[],
    ): AsyncGenerator<MessagePartUnion> {
      const tools = OpenAI.prototype.tools_to_openai_tools(
        options?.tools ?? [],
      );
      const stream = await client.chat.completions.create(
        {
          model: options?.model ?? adapter.config.model,
          messages: current,
          ...(tools && tools.length
            ? { tools, tool_choice: "auto" as const }
            : {}),
          stream: true,
        },
        {
          signal: options?.signal,
        },
      );

      const tool_calls_buffer = new Map<number, OpenAIToolCall>();
      let streamed_text = "";

      for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          streamed_text += delta.content;
          yield { type: "text", content: delta.content };
        }

        if (delta.tool_calls?.length) {
          for (const tc of delta.tool_calls) {
            const index = tc.index ?? 0;

            const prev =
              tool_calls_buffer.get(index) ??
              ({
                id: tc.id ?? "",
                type: "function",
                function: {
                  name: "",
                  arguments: "",
                },
              } as OpenAIToolCall);

            if (tc.id) prev.id = tc.id;
            if (tc.function?.name) {
              prev.function.name += tc.function.name;
            }
            if (tc.function?.arguments) {
              prev.function.arguments += tc.function.arguments;
            }

            tool_calls_buffer.set(index, prev);
          }
        }
      }

      const tool_calls = Array.from(tool_calls_buffer.values());
      if (tool_calls.length > 0) {
        const assistant_msg: ChatCompletionMessageParam = {
          role: "assistant",
          content: streamed_text || null,
          tool_calls: tool_calls,
        };
        current.push(assistant_msg);

        const tool_messages: ChatCompletionMessageParam[] = [];
        const functions = options?.tools ?? [];

        for (const call of tool_calls as ChatCompletionMessageToolCall[]) {
          if (call.type !== "function") continue;

          const name = call.function.name;
          const args_str = call.function.arguments;
          let tool_response = "No tools found";

          const tool = functions.find((item) => item.name === name);
          if (tool) {
            try {
              const args = args_str ? JSON.parse(args_str) : {};
              const res = await tool.call(args, options?.tool_context);

              tool_response =
                typeof res?.result === "string"
                  ? res.result
                  : "Tool returned invalid response";

              if (Array.isArray(res?.parts)) {
                for (const part of res.parts) yield part;
              }
            } catch (error) {
              logger.error({
                message: "Tool execution failed",
                tool: name,
                error: error instanceof Error ? error.message : String(error),
              });
              const error_message =
                error instanceof Error ? error.message : String(error);
              tool_response = `Tool ${name} failed: ${error_message}`;
            }
          } else {
            tool_response = `Tool ${name} not found`;
          }

          tool_messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: tool_response,
          });
        }

        current.push(...tool_messages);

        yield* generate_stream(client, adapter, current);
      }
    };

    yield* generate_stream(this.client, this, messages);
  }

  messages_to_content(
    message: Message[],
    options?: GenerateOptions,
  ): ChatCompletionMessageParam[] {
    const messages: ChatCompletionMessageParam[] = [];
    const system_prompt = options?.system_prompt ?? this.config.system_prompt;
    const has_system_message = message.some((msg) => msg.role === "system");

    if (system_prompt && !has_system_message) {
      messages.push({
        role: "system",
        content: system_prompt,
      });
    }

    for (const msg of message) {
      if (msg.role === "system") {
        const system_content = msg.parts
          .filter((part) => part.type === "text")
          .map((part) => String(part.content))
          .join("");
        if (system_content) {
          messages.push({ role: "system", content: system_content });
        }
        continue;
      }

      const content_parts: ChatCompletionContentPart[] = [];

      for (const part of msg.parts) {
        if (part.type === "text") {
          content_parts.push({ type: "text", text: String(part.content) });
        } else if (part.type === "image") {
          if (part.cached || typeof part.content === "string") {
            const cached = typeof part.content === "string" ? part.content : "";
            content_parts.push({
              type: "text",
              text: `[Cached Image] ${cached}`,
            });
          } else {
            content_parts.push({
              type: "image_url",
              image_url: {
                url: `data:${part.content.mime};base64,${part.content.url}`,
                detail: "auto",
              },
            });
          }
        }
      }

      if (content_parts.length === 0) {
        continue;
      }

      const all_text = content_parts.every((part) => part.type === "text");
      const content = all_text
        ? (content_parts as ChatCompletionContentPartText[])
            .map((part) => part.text)
            .join("")
        : content_parts;

      if (msg.role === "assistant") {
        const has_non_text = content_parts.some((part) => part.type !== "text");
        if (has_non_text) {
          logger.warn({
            message:
              "Assistant message contains non-text parts (e.g. images) which are not supported by OpenAI and will be discarded",
          });
        }
        const assistant_content = (
          content_parts as ChatCompletionContentPartText[]
        )
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("");
        messages.push({
          role: "assistant",
          content: assistant_content,
        });
      } else {
        messages.push({
          role: "user",
          content,
        });
      }
    }

    return messages;
  }

  tools_to_openai_tools(tools: Tools[]): ChatCompletionTool[] | undefined {
    if (!tools?.length) return undefined;

    return tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: this.parameters_to_openai_schema(
          tool.parameters ?? {},
          tool.required,
        ),
      },
    }));
  }

  private parameters_to_openai_schema(
    parameters: ToolParameters,
    required?: string[],
  ): Record<string, unknown> {
    return {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(parameters).map(([key, schema]) => [
          key,
          this.schema_to_openai(schema),
        ]),
      ),
      ...(required?.length ? { required } : {}),
    };
  }

  private schema_to_openai(
    schema: ToolParameterSchema,
  ): Record<string, unknown> {
    const base: Record<string, unknown> = {
      ...(schema.description !== undefined
        ? { description: schema.description }
        : {}),
      ...(schema.nullable !== undefined ? { nullable: schema.nullable } : {}),
    };

    switch (schema.type) {
      case "string":
        return {
          type: "string",
          ...base,
          ...(schema.enum?.length ? { enum: schema.enum } : {}),
        };

      case "number":
      case "integer":
        return {
          type: schema.type,
          ...base,
          ...(schema.minimum !== undefined ? { minimum: schema.minimum } : {}),
          ...(schema.maximum !== undefined ? { maximum: schema.maximum } : {}),
        };

      case "boolean":
        return { type: "boolean", ...base };

      case "array":
        return {
          type: "array",
          ...base,
          items: this.schema_to_openai(schema.items),
        };

      case "object":
        return {
          type: "object",
          ...base,
          properties: Object.fromEntries(
            Object.entries(schema.properties).map(([key, s]) => [
              key,
              this.schema_to_openai(s),
            ]),
          ),
          ...(schema.required?.length ? { required: schema.required } : {}),
        };
    }
  }

  content_to_message_parts(
    content: string | ChatCompletionContentPart[],
  ): MessagePartUnion[] {
    if (typeof content === "string") {
      return [{ type: "text", content }];
    }

    const parts: MessagePartUnion[] = [];

    for (const part of content) {
      if (part.type === "text") {
        parts.push({ type: "text", content: part.text });
      } else if (part.type === "image_url") {
        const imageUrl = part.image_url.url;

        const dataUrlMatch =
          typeof imageUrl === "string"
            ? /^data:(.+?);base64,(.*)$/.exec(imageUrl)
            : null;

        if (dataUrlMatch) {
          const [, mime, base64Data] = dataUrlMatch;
          parts.push({
            type: "image",
            content: {
              mime,
              url: base64Data,
            },
          });
        } else {
          parts.push({
            type: "image",
            content: {
              mime: "image/*",
              url: imageUrl,
            },
          });
        }
      }
    }

    return parts;
  }
}

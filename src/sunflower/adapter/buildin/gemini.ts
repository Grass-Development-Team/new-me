import logger from "@/logger";
import Adapter, { type GenerateOptions } from "..";

import type AdapterConfig from "../config";
import { type Message, type MessagePartUnion } from "../message";

import type Tools from "@/sunflower/tools";

import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  Type,
  type Content,
  type FunctionDeclaration,
  type Part,
  type SafetySetting,
  type Schema as GeminiSchema,
  type ToolListUnion,
} from "@google/genai";

import type { ToolParameters, ToolParameterSchema } from "@/sunflower/tools";

const SAFE_SETTINGS_BLOCK_NONE: SafetySetting[] = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

export interface GeminiConfig {
  use_gemini_tools?: boolean;
}

export default class Gemini extends Adapter<GeminiConfig> {
  id: string = "gemini";

  config: AdapterConfig<GeminiConfig>;

  private client: GoogleGenAI;

  constructor(config: AdapterConfig<GeminiConfig>) {
    super();

    this.config = config;

    this.client = new GoogleGenAI({
      apiKey: config.api_key,
      httpOptions: {
        baseUrl: config.base_url,
      },
    });
  }

  async generate(
    message: Message[],
    options?: GenerateOptions,
  ): Promise<Message> {
    const functions = options?.tools ?? [];
    const tools: ToolListUnion = this.config.extra_config?.use_gemini_tools
      ? [
          {
            googleSearch: {},
          },
          {
            urlContext: {},
          },
        ]
      : functions.length > 0
        ? [{ functionDeclarations: this.tools_to_gemini_tools(functions) }]
        : [];

    const run = async (
      signal: AbortSignal,
      mark_side_effect: () => void,
    ): Promise<Message> => {
      const contents = this.message_to_content(message);

      const generate = async (contents: Content[]): Promise<Message> => {
        const res = await this.client.models.generateContent({
          model: options?.model ?? this.config.model,
          contents: contents,
          config: {
            abortSignal: signal,
            systemInstruction:
              options?.system_prompt ?? this.config.system_prompt,
            safetySettings: SAFE_SETTINGS_BLOCK_NONE,
            tools: tools,
          },
        });
        const final_res: Message = {
          role: "assistant",
          parts: [],
        };

        const candidate = res.candidates?.[0];

        if (!candidate?.content) {
          throw new Error("No content generated");
        }

        const content = candidate.content;
        const model_parts = [...(content.parts ?? [])];

        final_res.parts.push(...this.content_to_message(content).parts);

        if (res.functionCalls?.length) {
          contents.push({
            role: "model",
            parts: [...model_parts],
          });
          const parts: Part[] = [];

          for (const call of res.functionCalls) {
            const tool = functions.find((tool) => tool.name === call.name);

            let tool_response: string = "No tools found";

            if (tool) {
              try {
                mark_side_effect();
                const res = await this.call_tool(
                  tool,
                  call.args ?? {},
                  options?.tool_context,
                  signal,
                );
                tool_response =
                  typeof res?.result === "string"
                    ? res.result
                    : "Tool returned invalid response";

                if (Array.isArray(res?.parts)) {
                  final_res.parts.push(...res.parts);
                }
              } catch (error) {
                if (signal.aborted) {
                  throw error;
                }

                logger.error({
                  event: "adapter.gemini.tool.failed",
                  tool: call.name,
                  error: error instanceof Error ? error.message : String(error),
                });
                tool_response = `Tool ${call.name} failed`;
              }
            } else {
              tool_response = `Tool ${call.name} not found`;
            }

            parts.push({
              functionResponse: {
                name: call.name,
                response: { result: tool_response },
              },
            });
          }

          contents.push({
            role: "user",
            parts: [...parts],
          });

          final_res.parts.push(...(await generate(contents)).parts);
        }

        return final_res;
      };

      return generate(contents);
    };

    return this.execute_with_retry(
      ({ signal, mark_side_effect }) => run(signal, mark_side_effect),
      options,
    );
  }

  async *generate_stream(
    message: Message[],
    options?: GenerateOptions,
  ): AsyncGenerator<MessagePartUnion> {
    const functions = options?.tools ?? [];
    const tools: ToolListUnion = this.config.extra_config?.use_gemini_tools
      ? [
          {
            googleSearch: {},
          },
          {
            urlContext: {},
          },
        ]
      : functions.length > 0
        ? [{ functionDeclarations: this.tools_to_gemini_tools(functions) }]
        : [];

    yield* this.execute_stream_with_retry(({ signal, mark_side_effect }) => {
      const contents = this.message_to_content(message);

      const generate = async function* (
        client: GoogleGenAI,
        config: AdapterConfig<GeminiConfig>,
        adapter: Gemini,
        all_tools: Tools[],
        contents: Content[],
      ): AsyncGenerator<MessagePartUnion> {
        logger.debug({
          event: "adapter.gemini.stream.request",
          contents,
        });

        const res = await client.models.generateContentStream({
          model: options?.model ?? config.model,
          contents: contents,
          config: {
            abortSignal: signal,
            systemInstruction: options?.system_prompt ?? config.system_prompt,
            safetySettings: SAFE_SETTINGS_BLOCK_NONE,
            tools: tools,
          },
        });
        const message: Part[] = [];

        for await (const chunk of res) {
          logger.debug({
            event: "adapter.gemini.stream.chunk",
            chunk,
          });

          const content = chunk.candidates?.[0]?.content;

          if (content) {
            for (const content_part of content.parts ?? []) {
              const msg_part =
                Gemini.prototype.part_to_message_part(content_part);

              if (msg_part) {
                message.push(content_part);
                yield msg_part;
              } else if (content_part.functionCall) {
                message.push(content_part);
              }
            }
          }

          if (!chunk.functionCalls?.length) {
            continue;
          }

          if (!content?.parts) {
            logger.warn({
              event: "adapter.gemini.stream.function_call_missing_parts",
            });
          }

          contents.push({
            role: "model",
            parts: [...message],
          });
          const parts: Part[] = [];

          for (const call of chunk.functionCalls) {
            const tool = all_tools.find((tool) => tool.name === call.name);

            let tool_response: string = "No tools found";

            if (tool) {
              try {
                mark_side_effect();
                const res = await adapter.call_tool(
                  tool,
                  call.args ?? {},
                  options?.tool_context,
                  signal,
                );
                tool_response =
                  typeof res?.result === "string"
                    ? res.result
                    : "Tool returned invalid response";

                if (Array.isArray(res?.parts)) {
                  for (const part of res.parts) yield part;
                }
              } catch (error) {
                if (signal.aborted) {
                  throw error;
                }

                logger.error({
                  event: "adapter.gemini.tool.failed",
                  tool: call.name,
                  error: error instanceof Error ? error.message : String(error),
                });
                tool_response = `Tool ${call.name} failed`;
              }
            } else {
              tool_response = `Tool ${call.name} not found`;
            }

            parts.push({
              functionResponse: {
                name: call.name,
                response: { result: tool_response },
              },
            });
          }

          contents.push({
            role: "user",
            parts: parts,
          });

          yield* generate(client, config, adapter, all_tools, contents);
          return;
        }
      };

      return generate(this.client, this.config, this, functions, contents);
    }, options);
  }

  message_to_content(message: Message[]): Content[] {
    return message.map((part) => {
      return {
        role: part.role === "assistant" ? "model" : "user",
        parts:
          (part.parts
            .filter((item) => item.type === "text" || item.type === "image")
            .map((item) => {
              if (item.type === "text") {
                return { text: item.content };
              } else if (item.type === "image") {
                return item.cached
                  ? {
                      text: `[Cached Image] ${item.content}`,
                    }
                  : {
                      inlineData: {
                        mimeType: item.content.mime,
                        data: item.content.url,
                      },
                    };
              }
            }) as Part[] | undefined) ?? [],
      };
    });
  }

  part_to_message_part(part: Part): MessagePartUnion | undefined {
    if (part.text && !part.thought) {
      return {
        type: "text",
        content: part.text,
      };
    } else if (part.inlineData) {
      return {
        type: "image",
        content: {
          mime: part.inlineData.mimeType,
          url: part.inlineData.data,
        },
      };
    }
  }

  content_to_message(content: Content): Message {
    return {
      role: content.role === "model" ? "assistant" : "user",
      parts:
        content?.parts
          ?.map((part) => {
            return Gemini.prototype.part_to_message_part(part);
          })
          ?.filter((part): part is MessagePartUnion => part !== undefined) ??
        [],
    };
  }

  tools_to_gemini_tools(tools: Tools[]): FunctionDeclaration[] {
    return tools.map((tool): FunctionDeclaration => {
      return {
        name: tool.name,
        description: tool.description,
        parameters: this.parameters_to_gemini_schema(
          tool.parameters ?? {},
          tool.required,
        ),
      };
    });
  }

  private parameters_to_gemini_schema(
    parameters: ToolParameters,
    required?: string[],
  ): GeminiSchema {
    return {
      type: Type.OBJECT,
      properties: Object.fromEntries(
        Object.entries(parameters).map(([key, schema]) => [
          key,
          this.schema_to_gemini(schema),
        ]),
      ),
      ...(required?.length ? { required } : {}),
    };
  }

  private schema_to_gemini(schema: ToolParameterSchema): GeminiSchema {
    const base: Partial<GeminiSchema> = {
      ...(schema.description !== undefined
        ? { description: schema.description }
        : {}),
      ...(schema.nullable !== undefined ? { nullable: schema.nullable } : {}),
    };

    switch (schema.type) {
      case "string":
        return {
          type: Type.STRING,
          ...base,
          ...(schema.enum?.length ? { enum: schema.enum } : {}),
        };

      case "number":
        return { type: Type.NUMBER, ...base };

      case "integer":
        return { type: Type.INTEGER, ...base };

      case "boolean":
        return { type: Type.BOOLEAN, ...base };

      case "array":
        return {
          type: Type.ARRAY,
          ...base,
          items: this.schema_to_gemini(schema.items),
        };

      case "object":
        return {
          type: Type.OBJECT,
          ...base,
          properties: Object.fromEntries(
            Object.entries(schema.properties).map(([key, s]) => [
              key,
              this.schema_to_gemini(s),
            ]),
          ),
          ...(schema.required?.length ? { required: schema.required } : {}),
        };
    }
  }
}

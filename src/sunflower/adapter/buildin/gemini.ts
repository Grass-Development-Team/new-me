import Adapter from "..";

import type AdapterConfig from "../config";
import {
  type Message,
  type GenerateOptions,
  type MessagePartUnion,
} from "../message";

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
  type ToolListUnion,
} from "@google/genai";

const SAFE_SETTINGS_BLOCK_NONE: SafetySetting[] = [
  {
    category: HarmCategory.HARM_CATEGORY_UNSPECIFIED,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
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
  {
    category: HarmCategory.HARM_CATEGORY_IMAGE_HATE,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_IMAGE_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_IMAGE_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_JAILBREAK,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

export default class Gemini extends Adapter {
  id: string = "gemini";

  config: AdapterConfig;

  get tools(): Tools[] {
    return this._tools;
  }

  set tools(tools: Tools[]) {
    this._tools = tools;
    this._gemini_tools_definitions = this.tools_to_gemini_tools(tools);
  }

  private client: GoogleGenAI;
  private _tools: Tools[] = [];
  private _gemini_tools_definitions: FunctionDeclaration[] = [];

  constructor(config: AdapterConfig, tools: Tools[] = []) {
    super();

    this.config = config;
    this.tools = tools;

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
    const contents = this.message_to_content(message);
    const tools: ToolListUnion = [
      {
        googleSearch: {},
      },
      {
        urlContext: {},
      },
      this._gemini_tools_definitions.length === 0
        ? undefined
        : {
            functionDeclarations: this._gemini_tools_definitions,
          },
      options?.tools
        ? { functionDeclarations: this.tools_to_gemini_tools(options.tools) }
        : undefined,
    ].filter((item) => item !== undefined);

    const generate = async (contents: Content[]) => {
      const res = await this.client.models.generateContent({
        model: options?.model ?? this.config.model,
        contents: contents,
        config: {
          abortSignal: options?.signal,
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

      const content = res.candidates![0]?.content;

      if (!content) {
        throw new Error("No content generated");
      }

      final_res.parts.push(...this.content_to_message(content).parts);

      if (res.functionCalls) {
        contents.push(res.candidates![0]!.content!);
        let parts: Part[] = [];

        for (const call of res.functionCalls) {
          const tool = this.tools.find((tool) => tool.name === call.name);

          let tool_response: string = "No tools found";

          if (tool) {
            tool_response = await tool.call(call.args);
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

        final_res.parts.push(...(await generate(contents)).parts);
      }

      return final_res;
    };

    return generate(contents);
  }

  async *generate_stream(
    message: Message[],
    options?: GenerateOptions,
  ): AsyncGenerator<MessagePartUnion> {
    const contents = this.message_to_content(message);
    const tools: ToolListUnion = [
      {
        googleSearch: {},
      },
      {
        urlContext: {},
      },
      this._gemini_tools_definitions.length === 0
        ? undefined
        : {
            functionDeclarations: this._gemini_tools_definitions,
          },
      options?.tools
        ? { functionDeclarations: this.tools_to_gemini_tools(options.tools) }
        : undefined,
    ].filter((item) => item !== undefined);

    const generate = async function* (
      client: GoogleGenAI,
      config: AdapterConfig,
      all_tools: Tools[],
      contents: Content[],
    ): AsyncGenerator<MessagePartUnion> {
      const res = await client.models.generateContentStream({
        model: options?.model ?? config.model,
        contents: contents,
        config: {
          abortSignal: options?.signal,
          systemInstruction: options?.system_prompt ?? config.system_prompt,
          safetySettings: SAFE_SETTINGS_BLOCK_NONE,
          tools: tools,
        },
      });
      const message: Part[] = [];

      for await (const part of res) {
        if (part.functionCalls) {
          message.push(...part.candidates![0]!.content!.parts!);
          contents.push({
            role: "model",
            parts: message,
          });
          let parts: Part[] = [];

          for (const call of part.functionCalls) {
            const tool = all_tools.find((tool) => tool.name === call.name);

            let tool_response: string = "No tools found";

            if (tool) {
              tool_response = await tool.call(call.args);
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

          yield* generate(client, config, all_tools, contents);
        }

        if (part.candidates) {
          const content = part.candidates[0]?.content;

          if (content) {
            for (const part of content.parts ?? []) {
              const msg_part = Gemini.prototype.part_to_message_part(part);

              if (msg_part) {
                message.push(part);
                yield msg_part;
              }
            }
          }
        }
      }
    };

    yield* generate(this.client, this.config, this.tools, contents);
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
          ?.filter((part) => part !== undefined) ?? [],
    };
  }

  tools_to_gemini_tools(tools: Tools[]): FunctionDeclaration[] {
    return tools.map((tool): FunctionDeclaration => {
      return {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: Type.OBJECT,
          properties: tool.parameters,
          required: tool.required,
        },
      };
    });
  }
}

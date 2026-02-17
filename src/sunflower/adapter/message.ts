export interface MessagePart<T = "text", C = string> {
  type: T;
  content: C;
  cached?: boolean;
}

export type TextMessagePart = MessagePart;
export type ImageMessagePart = MessagePart<
  "image",
  | {
      mime: string;
      url: string;
    }
  | string
>;
export type VideoMessagePart = MessagePart<"video", any | string>;
export type AudioMessagePart = MessagePart<"audio", any | string>;
export type OtherMessagePart = MessagePart<
  Exclude<string, "text" | "image" | "video" | "audio">,
  any | string
>;

export type MessagePartUnion =
  | TextMessagePart
  | ImageMessagePart
  | VideoMessagePart
  | AudioMessagePart
  | OtherMessagePart;

export type Message = {
  role: "user" | "assistant" | "system";
  parts: MessagePartUnion[];
};

export interface GenerateOptions {
  system_prompt?: string;
  model?: string;
  signal?: AbortSignal;
}

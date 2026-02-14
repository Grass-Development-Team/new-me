export enum MessageType {
  Text,
  Image,
  Video,
  Audio,
  Other,
}

export interface MessagePart<C = string> {
  type: MessageType;
  content: C;
}

export type Message = MessagePart[];

export interface GenerateOptions {
  signal?: AbortSignal;
}

export function text(content: string): MessagePart {
  return {
    type: MessageType.Text,
    content,
  };
}

export function image(url: string): MessagePart {
  return {
    type: MessageType.Image,
    content: url,
  };
}

export function video(url: string): MessagePart {
  return {
    type: MessageType.Video,
    content: url,
  };
}

export function audio(url: string): MessagePart {
  return {
    type: MessageType.Audio,
    content: url,
  };
}

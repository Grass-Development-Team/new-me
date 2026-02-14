import type { ChatCompletionMessageParam } from "openai/resources";

export interface Session {
  platform: string;
  id: string;
  history?: ChatCompletionMessageParam[];
}

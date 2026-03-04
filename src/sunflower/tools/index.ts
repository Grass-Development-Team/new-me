import type Sunflower from "..";
import type Instance from "../instance";
import type { UserMessageMetadata } from "../instance";

import type { MessagePartUnion } from "../adapter/message";

export interface ToolContext {
  sunflower: Sunflower;
  instance: Instance;
  scene: string;
  user?: UserMessageMetadata;
}

export interface ToolResponse {
  result: string;
  parts?: MessagePartUnion[];
}

export interface ToolParameters {
  [key: string]: any;
}

export default abstract class Tools<T = any> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters?: ToolParameters;
  abstract readonly required?: string[];

  abstract call(args: T, ctx?: ToolContext): Promise<ToolResponse>;
}

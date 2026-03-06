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

export type ToolParameterSchema =
  | ToolParameterString
  | ToolParameterNumber
  | ToolParameterBoolean
  | ToolParameterArray
  | ToolParameterObject;

interface ToolParameterBase {
  description?: string;
  nullable?: boolean;
}

export interface ToolParameterString extends ToolParameterBase {
  type: "string";
  enum?: string[];
}

export interface ToolParameterNumber extends ToolParameterBase {
  type: "number" | "integer";
  minimum?: number;
  maximum?: number;
}

export interface ToolParameterBoolean extends ToolParameterBase {
  type: "boolean";
}

export interface ToolParameterArray extends ToolParameterBase {
  type: "array";
  items: ToolParameterSchema;
}

export interface ToolParameterObject extends ToolParameterBase {
  type: "object";
  properties: ToolParameters;
  required?: string[];
}

export interface ToolParameters {
  [key: string]: ToolParameterSchema;
}

export default abstract class Tools<T = any> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters?: ToolParameters;
  abstract readonly required?: string[];

  abstract call(args: T, ctx?: ToolContext): Promise<ToolResponse>;
}

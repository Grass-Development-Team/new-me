import type Sunflower from "@/sunflower";

import type { ModelConfig } from "@/sunflower/config";

import type { Message, MessagePartUnion } from "@/sunflower/adapter/message";
import type { GenerateOptions } from "../adapter";

export default abstract class Scene<T = any> {
  abstract readonly scene: string;

  readonly model: ModelConfig;

  constructor(model: ModelConfig) {
    this.model = model;
  }

  abstract prompt(args: T): string;
  abstract generate(
    message: Message[],
    prompt: string,
    sunflower: Sunflower,
    option?: GenerateOptions,
  ): AsyncGenerator<MessagePartUnion>;
}

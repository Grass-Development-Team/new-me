import type Sunflower from "@/sunflower";

import type { ModelConfig } from "@/sunflower/config";

import type { Message, MessagePartUnion } from "@/sunflower/adapter/message";

export default abstract class Scene<T = any> {
  abstract readonly scene: string;

  protected readonly model: ModelConfig;

  constructor(model: ModelConfig) {
    this.model = model;
  }

  abstract prompt(args: T): string;
  abstract generate(
    message: Message[],
    args: T,
    signal: AbortSignal,
    sunflower: Sunflower,
  ): AsyncGenerator<MessagePartUnion>;
}

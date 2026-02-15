import type Sunflower from "@/sunflower";

import type { ModelConfig } from "@/sunflower/config";

import type { Message, MessagePartUnion } from "@/sunflower/adapter/message";

export default abstract class Scene {
  abstract readonly scene: string;

  protected readonly model: ModelConfig;

  constructor(model: ModelConfig) {
    this.model = model;
  }

  abstract prompt(args: any): string;
  abstract generate(
    message: Message[],
    sunflower: Sunflower,
  ): AsyncGenerator<MessagePartUnion>;
}

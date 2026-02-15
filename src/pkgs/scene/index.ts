import type { Message, MessagePartUnion } from "@/pkgs/adapter/message";

export default abstract class Scene {
  abstract readonly scene: string;

  abstract prompt(args: any): string;
  abstract generate(message: Message[]): AsyncGenerator<MessagePartUnion>;
}

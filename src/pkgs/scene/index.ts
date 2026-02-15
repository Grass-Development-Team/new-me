import type { Message } from "@/pkgs/adapter/message";

export default abstract class Scene {
  abstract readonly scene: string;

  abstract prompt(args: any): string;
  abstract gen_reply(message: Message): Object;
}

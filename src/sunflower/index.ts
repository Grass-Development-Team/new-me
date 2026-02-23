import logger from "@/logger";

import Storage from "@/sunflower/storage";

import type Adapter from "@/sunflower/adapter";
import type Config from "@/sunflower/config";
import type { Message } from "@/sunflower/adapter/message";

import Instance from "@/sunflower/instance";

export default class Sunflower {
  readonly config: Config;
  readonly storage: Storage;

  private instances: {
    [key: string]: Instance;
  } = {};

  constructor(config: Config) {
    this.config = config;
    this.storage = new Storage(config.storage);
  }

  async init() {
    await this.storage.init();
  }

  async *generate(
    platform: string,
    id: string,
    message: Message,
    scene: string,
    args: any,
  ) {
    const instance_id = `${platform}:${id}`;

    if (!(instance_id in this.instances)) {
      this.instances[instance_id] = new Instance(instance_id, this);
    }

    const stream = this.instances[instance_id]!.generate(message, scene, args);

    let msg_id;

    for await (const part of stream) {
      yield part;

      if (part.status === "start") {
        msg_id = part.data;
        logger.info({
          instance_id,
          msg_id,
          data: "Generation started",
        });
      }

      if (part.status === "part") {
        logger.info({
          instance_id,
          msg_id,
          data: part.data,
        });
      }

      if (part.status === "error") {
        logger.error({
          instance_id,
          msg_id,
          error: part.data,
        });
      }

      if (part.status === "end") {
        logger.info({
          instance_id,
          msg_id,
          data: "Generation ended",
        });
      }
    }
  }

  async abort(platform: string, id: string, msg_id: string) {
    const instance_id = `${platform}:${id}`;

    if (instance_id in this.instances) {
      const instance = this.instances[instance_id]!;
      instance.abort(msg_id);
    }
  }

  get_adapter(adapter: string): Adapter | undefined {
    if (adapter in this.config.drivers) {
      return this.config.drivers[adapter];
    }
  }

  get_scene(scene: string) {
    if (scene in this.config.scenes) {
      return this.config.scenes[scene];
    }
  }

  get_storage() {
    return this.storage;
  }
}

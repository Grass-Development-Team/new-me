import logger from "@/logger";

import Storage from "@/sunflower/storage";

import type Adapter from "@/sunflower/adapter";
import type Config from "@/sunflower/config";
import type { Message } from "@/sunflower/adapter/message";

import Instance, { type InstanceMeta } from "@/sunflower/instance";

export default class Sunflower {
  readonly config: Config;
  readonly storage: Storage;

  private instances: {
    [key: string]: Instance;
  } = {};

  constructor(config: Config) {
    this.config = config;
    this.storage = config.storage;
  }

  async init() {
    await this.storage.init();
  }

  async *generate(
    platform: string,
    platform_sid: string,
    meta: InstanceMeta,
    message: Message,
    scene: string,
    args: any,
  ) {
    const instance_id = `${platform}::${platform_sid}`;

    if (!(instance_id in this.instances)) {
      this.instances[instance_id] = new Instance(platform, platform_sid, this);
      await this.instances[instance_id]!.init();
    }

    const stream = this.instances[instance_id]!.generate(
      meta,
      message,
      scene,
      args,
    );

    let msg_id;

    for await (const part of stream) {
      yield part;

      if (part.status === "queue") {
        msg_id = part.data;
        logger.info({
          instance_id,
          msg_id,
          data: "Message queued",
        });
      }

      if (part.status === "start") {
        logger.info({
          instance_id,
          msg_id,
          data: "Generation start",
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
          data: "Generation end",
        });
      }
    }
  }

  async abort(platform: string, platform_sid: string, msg_id: string) {
    const instance_id = `${platform}::${platform_sid}`;

    if (instance_id in this.instances) {
      const instance = this.instances[instance_id]!;
      await instance.abort(msg_id);
    }
  }

  async abort_all(platform: string, platform_sid: string) {
    const instance_id = `${platform}::${platform_sid}`;

    if (instance_id in this.instances) {
      const instance = this.instances[instance_id]!;
      await instance.abort_all();
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

  get_instance(instance_id: string) {
    if (instance_id in this.instances) {
      return this.instances[instance_id]!;
    }
  }

  get_storage() {
    return this.storage;
  }
}

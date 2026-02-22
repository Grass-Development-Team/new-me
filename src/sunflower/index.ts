import Storage from "@/sunflower/storage";

import type Config from "@/sunflower/config";
import type Adapter from "@/sunflower/adapter";

export default class Sunflower {
  readonly config: Config;
  readonly storage: Storage;

  constructor(config: Config) {
    this.config = config;
    this.storage = new Storage(config.storage);
  }

  async init() {
    await this.storage.init();
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

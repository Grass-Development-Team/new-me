import Storage from "@/store";

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
    await this.storage.open();
  }

  get_adapter(adapter: string): Adapter | undefined {
    if (adapter in this.config.drivers) {
      return this.config.drivers[adapter];
    }
  }

  get_storage() {
    return this.storage;
  }
}

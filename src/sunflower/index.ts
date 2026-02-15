import type Config from "@/sunflower/config";
import type Adapter from "@/sunflower/adapter";

export default class Sunflower {
  readonly config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  get_adapter(adapter: string): Adapter | undefined {
    if (adapter in this.config.drivers) {
      return this.config.drivers[adapter];
    }
  }
}

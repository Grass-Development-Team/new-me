import type Adapter from "@/sunflower/adapter";
import type Scene from "@/sunflower/scene";
import type Tools from "@/sunflower/tools";

export default interface Config {
  persona: string;
  storage: string;
  max_history?: number;

  models: ModelsConfig;
  drivers: { [key: string]: Adapter<any> };
  scenes: { [key: string]: Scene };
  tools: Tools[];
}

export interface ModelsConfig {
  history_model: ModelConfig;
  image_read_model?: ModelConfig;
  image_gen_model?: ModelConfig;
}

export interface ModelConfig {
  model: string;
  driver: string;
}

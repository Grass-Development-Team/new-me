import type Adapter from "@/pkgs/adapter";
import type Scene from "@/pkgs/scene";

export default interface Config {
  persona: string;

  models: ModelsConfig;
  drivers: { [key: string]: Adapter };
  scenes: { [key: string]: Scene };
}

export interface ModelsConfig {
  base_model: ModelConfig;
  history_model: ModelConfig;
  image_read_model?: ModelConfig;
  image_gen_model?: ModelConfig;
}

export interface ModelConfig {
  model: string;
  driver: string;
}

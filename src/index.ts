import Sunflower from "@/sunflower";
import type Config from "@/sunflower/config";

import Gemini from "@/sunflower/adapter/buildin/gemini";
import IMScene from "@/sunflower/scene/buildin/im";

import serve from "@/server";

const config: Config = {
  persona: "",
  storage: "data",
  max_history: 30,

  models: {
    history_model: {
      model: "gemini-3-flash-preview",
      driver: "gemini",
    },
  },
  drivers: {
    gemini: new Gemini({
      base_url: "https://generativelanguage.googleapis.com",
      api_key: "your_key",
      model: "gemini-3-flash-preview",
      system_prompt: "You are a helpful assistant",
    }),
  },
  scenes: {
    im: new IMScene({
      model: "gemini-3-flash-preview",
      driver: "gemini",
    }),
  },
};

const sunflower = new Sunflower(config);

await sunflower.init();

await serve("0.0.0.0", 9000, sunflower);

import type Config from "@/sunflower/config";

import Gemini from "@/sunflower/adapter/buildin/gemini";

import IMScene from "@/sunflower/scene/buildin/im";

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

export default config;

import "@/config";
import type Config from "@/config";

import Gemini from "@/pkgs/adapter/buildin/gemini";

import IMScene from "@/pkgs/scene/buildin/im";

const config: Config = {
  persona: process.env["PERSONA"] || "",

  models: {
    base_model: { model: "gemini-3-flash-preview", driver: "gemini" },
    history_model: { model: "gemini-3-flash-preview", driver: "gemini" },
    image_read_model: { model: "gemini-3-flash-preview", driver: "gemini" },
    image_gen_model: { model: "gemini-3-flash-preview", driver: "gemini" },
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
    im: new IMScene(),
  },
};

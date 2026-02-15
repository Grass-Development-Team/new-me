import logger from "@/logger";

export interface Config {
  base_url: string;
  api_key: string;
  driver: string;
  persona: string;

  model: string;
  history_model: string;
  image_read_model?: string;
  image_gen_model?: string;
}

const api_key =
  process.env["API_KEY"] ||
  (() => {
    logger.error("require environment API_KEY");
    process.exit(-1);
  })();

const config: Config = {
  base_url: process.env["BASE_URL"] || "https://api.openai.com/v1",
  api_key: api_key,
  driver: process.env["DRIVER"] || "gemini",
  persona: process.env["PERSONA"] || "",

  model: process.env["MODEL"] || "gpt-5.2",
  history_model:
    process.env["HISTORY_MODEL"] || process.env["MODEL"] || "gpt-5.2",
  image_read_model: process.env["IMAGE_READ_MODEL"],
  image_gen_model: process.env["IMAGE_GEN_MODEL"],
};

export default config;

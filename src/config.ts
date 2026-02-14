import logger from "@/logger";

export interface Config {
  base: string;
  apiKey: string;
  basePrompt: string;
  model: string;
}

const apiKey =
  process.env["OPENAI_API_KEY"] ||
  (() => {
    logger.error("require environment OPENAI_API_KEY");
    process.exit(-1);
  })();

const config: Config = {
  base: process.env["OPENAI_BASE_URL"] || "https://api.openai.com/v1",
  apiKey: apiKey,
  basePrompt: process.env["PROMPT"] || "",
  model: process.env["MODEL"] || "gpt-4o-mini",
};

export default config;

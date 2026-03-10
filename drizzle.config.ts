import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/sunflower/storage/models",
  out: "./migrations",
});

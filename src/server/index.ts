import fastify from "fastify";
import fs from "fs/promises";
import { fastifyConnectPlugin } from "@connectrpc/connect-fastify";
import { createValidateInterceptor } from "@connectrpc/validate";

import Route from "./routes";

import type Sunflower from "@/sunflower";
import logger from "@/logger";

export default async function serve(
  host: string,
  port: number,
  sunflower: Sunflower,
) {
  const routes = new Route(sunflower);

  const server = fastify({
    http2: true,
    https: {
      key: await fs.readFile("./certs/key.pem", "utf-8"),
      cert: await fs.readFile("./certs/cert.pem", "utf-8"),
    },
  });

  await server.register(fastifyConnectPlugin, {
    interceptors: [createValidateInterceptor()],
    routes: (service) => routes.register(service),
  });

  await server.listen({
    host: host,
    port: port,
  });

  logger.info(`Server is running on port ${host}:${port}`);
}

import fastify from "fastify";
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

import fastify from "fastify";
import { fastifyConnectPlugin } from "@connectrpc/connect-fastify";
import { createValidateInterceptor } from "@connectrpc/validate";

import Route from "./routes";

import type Sunflower from "@/sunflower";
import logger from "@/logger";

export default async function serve(sunflower: Sunflower) {
  const routes = new Route(sunflower);

  const server = fastify({
    http2: true,
  });

  await server.register(fastifyConnectPlugin, {
    interceptors: [createValidateInterceptor()],
    routes: routes.register,
  });

  await server.listen({
    host: "0.0.0.0",
    port: 9000,
  });

  logger.info("Server is running on port 9000");
}

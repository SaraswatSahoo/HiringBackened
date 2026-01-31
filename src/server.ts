import http from "http";
import app from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";

const server = http.createServer(app);

const start = async () => {
  server.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
  });
};

const shutdown = async () => {
  console.log("Graceful shutdown...");
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();

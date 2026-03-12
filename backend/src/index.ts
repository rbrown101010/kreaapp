import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import "./env";
import { sampleRouter } from "./routes/sample";
import { elementsRouter } from "./routes/elements";
import { generateRouter } from "./routes/generate";
import { youtubeRouter } from "./routes/youtube";
import { logger } from "hono/logger";

const app = new Hono();

// CORS middleware - allows all origins by default
app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
  })
);

// Logging
app.use("*", logger());

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// Routes
app.route("/api/sample", sampleRouter);
app.route("/api/elements", elementsRouter);
app.route("/api/generate", generateRouter);
app.route("/api/youtube", youtubeRouter);

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};

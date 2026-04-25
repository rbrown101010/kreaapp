#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

const API_BASE = "https://chorus.host";
const SLUG = process.env.CHORUS_WORKER_SLUG || "riley-thumbnail-api";
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const WORKER_PATH = path.join(ROOT, "chorus-worker", "index.js");
const METADATA_PATH = path.join(ROOT, "chorus-worker", "metadata.json");

const chorusApiKey = process.env.CHORUS_API_KEY;
const openAiApiKey = process.env.OPENAI_API_KEY;

if (!chorusApiKey) {
  throw new Error("CHORUS_API_KEY is required");
}

if (!openAiApiKey) {
  throw new Error("OPENAI_API_KEY is required");
}

const authHeaders = {
  Authorization: `Bearer ${chorusApiKey}`,
};

async function api(pathname, options = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message = typeof data === "string" ? data : data?.error || data?.message || response.statusText;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

async function ensureWorker() {
  try {
    await api(`/v1/workers/${SLUG}`);
    console.log(`Worker exists: ${SLUG}`);
  } catch (error) {
    if (error.status !== 404) throw error;
    await api("/v1/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: SLUG }),
    });
    console.log(`Created worker: ${SLUG}`);
  }
}

async function deployWorker() {
  const [code, metadataRaw] = await Promise.all([
    readFile(WORKER_PATH),
    readFile(METADATA_PATH, "utf8"),
  ]);

  const form = new FormData();
  form.append("metadata", metadataRaw);
  form.append("file", new Blob([code], { type: "application/javascript" }), "index.js");

  await api(`/v1/workers/${SLUG}/deploy`, {
    method: "POST",
    body: form,
  });
  console.log(`Deployed worker: https://${SLUG}.worker.chorus.host`);
}

async function setSecret(name, value) {
  await api(`/v1/workers/${SLUG}/secrets/${name}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  console.log(`Set worker secret: ${name}`);
}

await ensureWorker();
await deployWorker();
await setSecret("OPENAI_API_KEY", openAiApiKey);

console.log(`Worker URL: https://${SLUG}.worker.chorus.host`);

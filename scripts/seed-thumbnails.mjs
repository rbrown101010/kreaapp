#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const API_URL = (process.env.THUMBNAIL_API_URL || "https://riley-thumbnail-api.worker.chorus.host").replace(/\/$/, "");

const sources = [
  ...Array.from({ length: 5 }, (_, index) => ({
    path: `/Users/rileybrown/Remotion/Riley/youtube-thumbnail-run/generated/thumbnail-${String(index + 1).padStart(2, "0")}.png`,
    prompt: `Greg Isenberg-style Riley thumbnail ${index + 1}: Codex can now make videos with Remotion`,
    source: "greg-isenberg-run",
  })),
  ...Array.from({ length: 5 }, (_, index) => ({
    path: `/Users/rileybrown/Remotion/Riley/youtube-thumbnail-run/matt-wolfe-remotion/generated/thumbnail-${String(index + 1).padStart(2, "0")}.png`,
    prompt: `Matt Wolfe-style Riley thumbnail ${index + 1}: Codex can now make videos with Remotion`,
    source: "matt-wolfe-run",
  })),
];

const images = [];
for (const source of sources) {
  const buffer = await readFile(source.path);
  images.push({
    imageBase64: buffer.toString("base64"),
    mimeType: "image/png",
    aspectRatio: "16:9",
    prompt: source.prompt,
    source: source.source,
    sourceHash: createHash("sha256").update(buffer).digest("hex"),
  });
}

const response = await fetch(`${API_URL}/api/import`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ images }),
});

const data = await response.json();
if (!response.ok) {
  throw new Error(data?.error || data?.details || "Failed to seed thumbnails");
}

console.log(`Seeded ${data.imported} thumbnails into ${API_URL}`);

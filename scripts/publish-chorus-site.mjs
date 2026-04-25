#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const API_BASE = "https://chorus.host";
const SITE_SLUG = process.env.CHORUS_SITE_SLUG || "riley-thumbnail-studio";
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DIST = path.join(ROOT, "webapp", "dist");
const CLAIM_TOKEN_PATH = path.join(ROOT, ".chorus", `${SITE_SLUG}.claim-token`);

const chorusApiKey = process.env.CHORUS_API_KEY;
if (!chorusApiKey) {
  throw new Error("CHORUS_API_KEY is required");
}

const authHeaders = {
  Authorization: `Bearer ${chorusApiKey}`,
};

async function api(pathname, options = {}) {
  const headers = {
    ...authHeaders,
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${pathname}`, {
    ...options,
    headers,
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
    error.data = data;
    throw error;
  }

  return {
    data,
    headers: response.headers,
  };
}

async function walk(dir, prefix = "") {
  const entries = await readdir(dir);
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry);
    const relative = path.join(prefix, entry);
    const info = await stat(absolute);
    if (info.isDirectory()) {
      files.push(...(await walk(absolute, relative)));
    } else {
      files.push({
        absolute,
        path: `/${relative.split(path.sep).join("/")}`,
      });
    }
  }
  return files;
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

async function buildManifest() {
  const files = await walk(DIST);
  const manifest = [];
  for (const file of files) {
    const buffer = await readFile(file.absolute);
    manifest.push({
      path: file.path,
      size: buffer.byteLength,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      contentType: contentType(file.path),
      absolute: file.absolute,
    });
  }
  return manifest;
}

function publicManifest(manifest) {
  return manifest.map(({ path, size, sha256, contentType }) => ({
    path: path.startsWith("/") ? path.slice(1) : path,
    size,
    hash: `sha256:${sha256}`,
    contentType,
  }));
}

async function createSite(manifest) {
  try {
    const { data, headers } = await api("/v1/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: SITE_SLUG,
        files: publicManifest(manifest),
      }),
    });
    const claimToken = headers.get("x-claim-token");
    if (claimToken) {
      await mkdir(path.dirname(CLAIM_TOKEN_PATH), { recursive: true });
      await writeFile(CLAIM_TOKEN_PATH, claimToken);
    }
    console.log(`Created site: ${SITE_SLUG}`);
    return data;
  } catch (error) {
    if (error.status !== 409) throw error;
    console.log(`Site exists: ${SITE_SLUG}`);
    return null;
  }
}

async function getClaimHeaders() {
  try {
    const token = await readFile(CLAIM_TOKEN_PATH, "utf8");
    return token.trim() ? { "X-Claim-Token": token.trim() } : {};
  } catch {
    return {};
  }
}

async function createVersion(manifest) {
  const claimHeaders = await getClaimHeaders();
  const { data } = await api(`/v1/sites/${SITE_SLUG}/versions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...claimHeaders,
    },
    body: JSON.stringify({
      files: publicManifest(manifest),
    }),
  });
  return data;
}

async function uploadPending(version, manifest) {
  const pending = version.uploads?.pending || version.pendingUploads || version.pending || [];
  const normalizedPending = pending.map((item) => {
    const pendingPath = typeof item === "string" ? item : item.path;
    return {
      path: pendingPath?.startsWith("/") ? pendingPath : `/${pendingPath}`,
      uploadUrl: typeof item === "string" ? null : item.uploadUrl || item.url,
    };
  });
  const pendingPaths = new Set(normalizedPending.map((item) => item.path));
  const uploadByPath = new Map(normalizedPending.map((item) => [item.path, item.uploadUrl]));

  for (const file of manifest) {
    if (pendingPaths.size > 0 && !pendingPaths.has(file.path)) continue;

    const url = uploadByPath.get(file.path);
    if (!url) continue;

    const buffer = await readFile(file.absolute);
    await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": file.contentType },
      body: buffer,
    });
    console.log(`Uploaded ${file.path}`);
  }
}

async function finalizeVersion(version) {
  const claimHeaders = await getClaimHeaders();
  const versionId = version.version?.id || version.id || version.versionId;
  if (!versionId) {
    throw new Error("Chorus did not return a version id");
  }

  await api(`/v1/sites/${SITE_SLUG}/versions/${versionId}/finalize`, {
    method: "POST",
    headers: claimHeaders,
  });
}

const manifest = await buildManifest();
const created = await createSite(manifest);
const version = created || (await createVersion(manifest));
await uploadPending(version, manifest);
await finalizeVersion(version);

console.log(`Site URL: https://${SITE_SLUG}.chorus.host`);

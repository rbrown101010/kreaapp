const IMAGE_INDEX_KEY = "images:index";
const ELEMENT_INDEX_KEY = "elements:index";

const COLORS = [
  "#F59E0B",
  "#EF4444",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
  "#84CC16",
  "#6366F1",
];

const ASPECT_TO_SIZE = {
  "16:9": "1536x864",
  "9:16": "864x1536",
  "1:1": "1024x1024",
  "4:3": "1536x1024",
  "3:4": "1024x1536",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function cleanBase64(value = "") {
  const commaIndex = value.indexOf(",");
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function getIndex(env, key) {
  const raw = await env.THUMBNAILS.get(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function putIndex(env, key, ids) {
  await env.THUMBNAILS.put(key, JSON.stringify(ids));
}

async function getImageMeta(env, id) {
  const raw = await env.THUMBNAILS.get(`image-meta:${id}`);
  return raw ? JSON.parse(raw) : null;
}

async function getImageRecord(env, id) {
  const [meta, imageBase64] = await Promise.all([
    getImageMeta(env, id),
    env.THUMBNAILS.get(`image-blob:${id}`),
  ]);

  if (!meta || !imageBase64) return null;
  return { ...meta, imageBase64 };
}

async function saveImage(env, input) {
  const id = input.id || crypto.randomUUID();
  const createdAt = input.createdAt || new Date().toISOString();
  const meta = {
    id,
    prompt: input.prompt || "Untitled thumbnail",
    aspectRatio: input.aspectRatio || "16:9",
    mimeType: input.mimeType || "image/png",
    favorite: Boolean(input.favorite),
    source: input.source || "generated",
    parentId: input.parentId || null,
    sourceHash: input.sourceHash || null,
    createdAt,
  };

  if (meta.sourceHash) {
    const existingId = await env.THUMBNAILS.get(`image-hash:${meta.sourceHash}`);
    if (existingId) {
      const existing = await getImageRecord(env, existingId);
      if (existing) return existing;
    }
  }

  await Promise.all([
    env.THUMBNAILS.put(`image-blob:${id}`, cleanBase64(input.imageBase64 || "")),
    env.THUMBNAILS.put(`image-meta:${id}`, JSON.stringify(meta)),
  ]);

  if (meta.sourceHash) {
    await env.THUMBNAILS.put(`image-hash:${meta.sourceHash}`, id);
  }

  const index = await getIndex(env, IMAGE_INDEX_KEY);
  const nextIndex = [id, ...index.filter((existingId) => existingId !== id)];
  await putIndex(env, IMAGE_INDEX_KEY, nextIndex);

  return { ...meta, imageBase64: cleanBase64(input.imageBase64 || "") };
}

async function listImages(env, url) {
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") || "0", 10));
  const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("limit") || "12", 10)));
  const index = await getIndex(env, IMAGE_INDEX_KEY);
  const ids = index.slice(offset, offset + limit);
  const images = (await Promise.all(ids.map((id) => getImageRecord(env, id)))).filter(Boolean);

  return json({
    images,
    total: index.length,
    hasMore: offset + ids.length < index.length,
  });
}

async function listElements(env, url) {
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") || "0", 10));
  const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("limit") || "20", 10)));
  const index = await getIndex(env, ELEMENT_INDEX_KEY);
  const ids = index.slice(offset, offset + limit);
  const elements = (
    await Promise.all(
      ids.map(async (id) => {
        const raw = await env.THUMBNAILS.get(`element:${id}`);
        return raw ? JSON.parse(raw) : null;
      })
    )
  ).filter(Boolean);

  return json({
    elements,
    total: index.length,
    hasMore: offset + ids.length < index.length,
  });
}

async function createElement(env, body) {
  if (!body.name || !body.imageBase64) {
    return json({ error: "Name and image are required" }, 400);
  }

  const id = crypto.randomUUID();
  const element = {
    id,
    name: String(body.name),
    imageBase64: cleanBase64(body.imageBase64),
    mimeType: body.mimeType || "image/png",
    color: body.color || getRandomColor(),
    createdAt: new Date().toISOString(),
  };

  await env.THUMBNAILS.put(`element:${id}`, JSON.stringify(element));
  const index = await getIndex(env, ELEMENT_INDEX_KEY);
  await putIndex(env, ELEMENT_INDEX_KEY, [id, ...index.filter((existingId) => existingId !== id)]);

  return json({ element }, 201);
}

async function updateElement(env, id, body) {
  const raw = await env.THUMBNAILS.get(`element:${id}`);
  if (!raw) return json({ error: "Element not found" }, 404);

  const element = JSON.parse(raw);
  const updated = {
    ...element,
    name: body.name ? String(body.name) : element.name,
    color: body.color || element.color,
  };

  await env.THUMBNAILS.put(`element:${id}`, JSON.stringify(updated));
  return json({ element: updated });
}

async function deleteElement(env, id) {
  const raw = await env.THUMBNAILS.get(`element:${id}`);
  if (!raw) return json({ error: "Element not found" }, 404);

  await env.THUMBNAILS.delete(`element:${id}`);
  const index = await getIndex(env, ELEMENT_INDEX_KEY);
  await putIndex(env, ELEMENT_INDEX_KEY, index.filter((existingId) => existingId !== id));

  return json({ success: true });
}

function base64ToBlob(base64, mimeType = "image/png") {
  const cleaned = cleanBase64(base64);
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

async function fetchOpenAIImage(env, body, sourceImage) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const aspectRatio = body.aspectRatio || "16:9";
  const size = ASPECT_TO_SIZE[aspectRatio] || ASPECT_TO_SIZE["16:9"];
  const referenceImages = Array.isArray(body.referenceImages)
    ? body.referenceImages.filter((image) => image?.imageBase64).slice(0, 8)
    : [];

  if (sourceImage || referenceImages.length > 0) {
    const form = new FormData();
    form.append("model", "gpt-image-2");
    form.append("prompt", buildEditPrompt(body.prompt, aspectRatio, Boolean(sourceImage), referenceImages));
    form.append("size", size);
    form.append("quality", "high");
    form.append("output_format", "png");

    if (sourceImage) {
      form.append(
        "image[]",
        base64ToBlob(sourceImage.imageBase64, sourceImage.mimeType || "image/png"),
        "source.png"
      );
    }

    referenceImages.forEach((image, index) => {
      form.append(
        "image[]",
        base64ToBlob(image.imageBase64, image.mimeType || "image/png"),
        image.name || `reference-${index + 1}.png`
      );
    });

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    return parseOpenAIResponse(response);
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt: buildGenerationPrompt(body.prompt, aspectRatio),
      size,
      quality: "high",
      output_format: "png",
    }),
  });

  return parseOpenAIResponse(response);
}

function buildGenerationPrompt(prompt, aspectRatio) {
  return [
    `${prompt}`,
    "",
    "Create a high-retention YouTube thumbnail.",
    `Canvas: ${aspectRatio}.`,
    "Use bold readable text, strong contrast, a clear focal point, and no tiny text.",
    "Return a finished PNG thumbnail.",
  ].join("\n");
}

function buildEditPrompt(prompt, aspectRatio, hasSource, references) {
  const lines = [
    `${prompt}`,
    "",
    "Create a polished YouTube thumbnail from the attached images.",
    `Canvas: ${aspectRatio}.`,
  ];

  if (hasSource) {
    lines.push("Use the first attached image as the image being edited.");
  }

  if (references.length > 0) {
    lines.push("Use the other attached images as visual references for person likeness, style, logos, or layout.");
  }

  lines.push("Keep the target person recognizable. Use bold readable text and strong contrast.");
  return lines.join("\n");
}

async function parseOpenAIResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data?.error?.message || text || "OpenAI image generation failed";
    throw new Error(message);
  }

  const first = data?.data?.[0];
  const base64 = first?.b64_json || first?.image_base64 || first?.base64_json;

  if (base64) {
    return {
      imageBase64: base64,
      mimeType: "image/png",
    };
  }

  if (first?.url) {
    const imageResponse = await fetch(first.url);
    if (!imageResponse.ok) throw new Error("OpenAI returned an image URL that could not be fetched");
    const buffer = await imageResponse.arrayBuffer();
    return {
      imageBase64: arrayBufferToBase64(buffer),
      mimeType: imageResponse.headers.get("Content-Type") || "image/png",
    };
  }

  throw new Error("OpenAI did not return an image");
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function generateImage(env, body) {
  if (!body.prompt) return json({ error: "Prompt is required" }, 400);

  try {
    const generated = await fetchOpenAIImage(env, body);
    const saved = await saveImage(env, {
      imageBase64: generated.imageBase64,
      mimeType: generated.mimeType,
      prompt: body.prompt,
      aspectRatio: body.aspectRatio || "16:9",
      source: "generated",
    });

    return json({
      id: saved.id,
      image: saved.imageBase64,
      imageBase64: saved.imageBase64,
      mimeType: saved.mimeType,
      imageRecord: saved,
    });
  } catch (error) {
    return json({ error: "Failed to generate image", details: error.message }, 500);
  }
}

async function editImage(env, id, body) {
  if (!body.prompt) return json({ error: "Prompt is required" }, 400);

  const sourceImage = await getImageRecord(env, id);
  if (!sourceImage) return json({ error: "Image not found" }, 404);

  try {
    const generated = await fetchOpenAIImage(env, body, sourceImage);
    const saved = await saveImage(env, {
      imageBase64: generated.imageBase64,
      mimeType: generated.mimeType,
      prompt: body.prompt,
      aspectRatio: body.aspectRatio || sourceImage.aspectRatio || "16:9",
      source: "edit",
      parentId: id,
    });

    return json({
      id: saved.id,
      image: saved.imageBase64,
      imageBase64: saved.imageBase64,
      mimeType: saved.mimeType,
      imageRecord: saved,
    });
  } catch (error) {
    return json({ error: "Failed to edit image", details: error.message }, 500);
  }
}

async function toggleFavorite(env, id) {
  const meta = await getImageMeta(env, id);
  if (!meta) return json({ error: "Image not found" }, 404);

  const updated = { ...meta, favorite: !meta.favorite };
  await env.THUMBNAILS.put(`image-meta:${id}`, JSON.stringify(updated));
  return json({ success: true, favorite: updated.favorite });
}

async function deleteImage(env, id) {
  const meta = await getImageMeta(env, id);
  if (!meta) return json({ error: "Image not found" }, 404);

  await Promise.all([
    env.THUMBNAILS.delete(`image-meta:${id}`),
    env.THUMBNAILS.delete(`image-blob:${id}`),
    meta.sourceHash ? env.THUMBNAILS.delete(`image-hash:${meta.sourceHash}`) : Promise.resolve(),
  ]);

  const index = await getIndex(env, IMAGE_INDEX_KEY);
  await putIndex(env, IMAGE_INDEX_KEY, index.filter((existingId) => existingId !== id));

  return json({ success: true });
}

async function importImages(env, body) {
  const images = Array.isArray(body.images) ? body.images : [];
  if (images.length === 0) return json({ error: "No images provided" }, 400);

  const saved = [];
  for (const image of images.slice(0, 50)) {
    if (!image.imageBase64) continue;
    saved.push(
      await saveImage(env, {
        imageBase64: image.imageBase64,
        mimeType: image.mimeType || "image/png",
        prompt: image.prompt || "Imported thumbnail",
        aspectRatio: image.aspectRatio || "16:9",
        source: image.source || "import",
        sourceHash: image.sourceHash || null,
        createdAt: image.createdAt || null,
      })
    );
  }

  return json({ imported: saved.length, images: saved });
}

function extractVideoId(rawUrl) {
  const url = String(rawUrl || "");
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function youtubeThumbnail(body) {
  const videoId = extractVideoId(body.youtubeUrl);
  if (!videoId) {
    return json({ error: "Invalid YouTube URL. Could not extract video ID." }, 400);
  }

  return json({
    videoId,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
  });
}

async function handleRequest(request, env) {
  if (!env.THUMBNAILS) {
    return json({ error: "THUMBNAILS KV binding is not configured" }, 500);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (path === "/health") return json({ status: "ok" });

  if (path === "/api/generate" && method === "GET") return listImages(env, url);
  if (path === "/api/generate" && method === "POST") return generateImage(env, await readJson(request));
  if (path === "/api/import" && method === "POST") return importImages(env, await readJson(request));

  const editMatch = path.match(/^\/api\/generate\/([^/]+)\/edit$/);
  if (editMatch && method === "POST") return editImage(env, editMatch[1], await readJson(request));

  const favoriteMatch = path.match(/^\/api\/generate\/([^/]+)\/favorite$/);
  if (favoriteMatch && method === "PATCH") return toggleFavorite(env, favoriteMatch[1]);

  const imageMatch = path.match(/^\/api\/generate\/([^/]+)$/);
  if (imageMatch && method === "DELETE") return deleteImage(env, imageMatch[1]);

  if (path === "/api/elements" && method === "GET") return listElements(env, url);
  if (path === "/api/elements" && method === "POST") return createElement(env, await readJson(request));

  const elementMatch = path.match(/^\/api\/elements\/([^/]+)$/);
  if (elementMatch && method === "PATCH") return updateElement(env, elementMatch[1], await readJson(request));
  if (elementMatch && method === "DELETE") return deleteElement(env, elementMatch[1]);

  if (path === "/api/youtube/thumbnail" && method === "POST") return youtubeThumbnail(await readJson(request));

  return json({ error: "Not found" }, 404);
}

export default {
  fetch: handleRequest,
};

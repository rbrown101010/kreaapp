import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

const generateRouter = new Hono();

// Nano Banana Pro API endpoint
const NANO_BANANA_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent";

// Schema for reference images
const referenceImageSchema = z.object({
  name: z.string(),
  imageBase64: z.string(),
  mimeType: z.string(),
});

// Schema for generate request
const generateSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  aspectRatio: z
    .enum(["16:9", "1:1", "9:16", "4:3", "3:4"])
    .default("16:9"),
  referenceImages: z.array(referenceImageSchema).optional(),
});

// GET /api/generate - Get all saved generated images with pagination
generateRouter.get("/", async (c) => {
  try {
    const offset = Math.max(0, parseInt(c.req.query("offset") || "0", 10));
    const limit = Math.max(1, Math.min(100, parseInt(c.req.query("limit") || "12", 10)));

    const [images, total] = await Promise.all([
      prisma.generatedImage.findMany({
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.generatedImage.count(),
    ]);

    const hasMore = offset + images.length < total;

    return c.json({ images, total, hasMore });
  } catch (error) {
    console.error("Error fetching generated images:", error);
    return c.json({ error: "Failed to fetch images" }, 500);
  }
});

// POST /api/generate - Generate an image using Nano Banana Pro API
generateRouter.post(
  "/",
  zValidator("json", generateSchema),
  async (c) => {
    try {
      const { prompt, aspectRatio, referenceImages } = c.req.valid("json");

      const apiKey = process.env.EXPO_PUBLIC_VIBECODE_GOOGLE_API_KEY;
      if (!apiKey) {
        return c.json({ error: "API key not configured" }, 500);
      }

      // Build content parts
      const parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [];

      // Add reference images if provided
      if (referenceImages && referenceImages.length > 0) {
        console.log(`Processing ${referenceImages.length} reference images`);
        for (const ref of referenceImages) {
          // Strip data URL prefix if present (e.g., "data:image/png;base64,")
          let imageData = ref.imageBase64;
          if (imageData.includes(',')) {
            imageData = imageData.split(',')[1];
          }

          console.log(`Adding reference image: ${ref.name}, mimeType: ${ref.mimeType}, data length: ${imageData.length}`);

          // Add the image data
          parts.push({
            inlineData: {
              mimeType: ref.mimeType,
              data: imageData,
            },
          });
        }

        // Build prompt with reference mentions
        const refNames = referenceImages.map((r) => r.name).join(", ");
        parts.push({
          text: `Using the reference images provided (${refNames}), ${prompt}`,
        });
      } else {
        // Just text prompt
        parts.push({ text: prompt });
      }

      // Build request body
      const requestBody = {
        contents: [
          {
            parts,
          },
        ],
        generationConfig: {
          responseModalities: ["Image"],
          imageConfig: {
            aspectRatio,
          },
        },
      };

      // Make API request
      const response = await fetch(`${NANO_BANANA_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Nano Banana API error:", errorText);
        return c.json(
          {
            error: "Failed to generate image",
            details: errorText,
          },
          response.status as 400 | 401 | 403 | 500
        );
      }

      const data = await response.json();

      // Extract generated image from response
      const generatedImage = data.candidates?.[0]?.content?.parts?.find(
        (p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData
      )?.inlineData;

      if (!generatedImage) {
        return c.json(
          {
            error: "No image generated",
            details: "The API did not return an image",
          },
          500
        );
      }

      // Save to database
      const savedImage = await prisma.generatedImage.create({
        data: {
          imageBase64: generatedImage.data,
          mimeType: generatedImage.mimeType || "image/png",
          prompt,
          aspectRatio,
        },
      });

      return c.json({
        id: savedImage.id,
        image: generatedImage.data,
        mimeType: generatedImage.mimeType || "image/png",
      });
    } catch (error) {
      console.error("Error generating image:", error);
      return c.json(
        {
          error: "Failed to generate image",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);

// DELETE /api/generate/:id - Delete a generated image
generateRouter.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    const image = await prisma.generatedImage.findUnique({ where: { id } });
    if (!image) {
      return c.json({ error: "Image not found" }, 404);
    }

    await prisma.generatedImage.delete({ where: { id } });

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting image:", error);
    return c.json({ error: "Failed to delete image" }, 500);
  }
});

// PATCH /api/generate/:id/favorite - Toggle favorite status
generateRouter.patch("/:id/favorite", async (c) => {
  try {
    const id = c.req.param("id");

    const image = await prisma.generatedImage.findUnique({ where: { id } });
    if (!image) {
      return c.json({ error: "Image not found" }, 404);
    }

    const updatedImage = await prisma.generatedImage.update({
      where: { id },
      data: { favorite: !image.favorite },
    });

    return c.json({ success: true, favorite: updatedImage.favorite });
  } catch (error) {
    console.error("Error toggling favorite:", error);
    return c.json({ error: "Failed to toggle favorite" }, 500);
  }
});

export { generateRouter };

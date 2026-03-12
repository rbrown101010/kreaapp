import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

const elementsRouter = new Hono();

// 10 distinct colors for elements
const ELEMENT_COLORS = [
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#10B981", // Emerald
  "#3B82F6", // Blue
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
  "#84CC16", // Lime
  "#6366F1", // Indigo
];

function getRandomColor(): string {
  return ELEMENT_COLORS[Math.floor(Math.random() * ELEMENT_COLORS.length)];
}

// GET /api/elements - Get all saved elements with pagination
elementsRouter.get("/", async (c) => {
  try {
    const offset = Math.max(0, parseInt(c.req.query("offset") || "0", 10));
    const limit = Math.max(1, Math.min(100, parseInt(c.req.query("limit") || "20", 10)));

    const [elements, total] = await Promise.all([
      prisma.element.findMany({
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.element.count(),
    ]);

    const hasMore = offset + elements.length < total;

    return c.json({ elements, total, hasMore });
  } catch (error) {
    console.error("Error fetching elements:", error);
    return c.json({ error: "Failed to fetch elements" }, 500);
  }
});

// POST /api/elements - Create a new element
elementsRouter.post(
  "/",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1, "Name is required"),
      imageBase64: z.string().min(1, "Image data is required"),
      mimeType: z.string().min(1, "MIME type is required"),
    })
  ),
  async (c) => {
    try {
      const { name, imageBase64, mimeType } = c.req.valid("json");

      const newElement = await prisma.element.create({
        data: {
          name,
          imageBase64,
          mimeType,
          color: getRandomColor(),
        },
      });

      return c.json({ element: newElement }, 201);
    } catch (error) {
      console.error("Error creating element:", error);
      return c.json({ error: "Failed to create element" }, 500);
    }
  }
);

// PATCH /api/elements/:id - Update an element's name and/or color
elementsRouter.patch(
  "/:id",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1, "Name is required").optional(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
    })
  ),
  async (c) => {
    try {
      const id = c.req.param("id");
      const { name, color } = c.req.valid("json");

      const element = await prisma.element.findUnique({ where: { id } });
      if (!element) {
        return c.json({ error: "Element not found" }, 404);
      }

      const updateData: { name?: string; color?: string } = {};
      if (name) updateData.name = name;
      if (color) updateData.color = color;

      const updatedElement = await prisma.element.update({
        where: { id },
        data: updateData,
      });

      return c.json({ element: updatedElement });
    } catch (error) {
      console.error("Error updating element:", error);
      return c.json({ error: "Failed to update element" }, 500);
    }
  }
);

// DELETE /api/elements/:id - Delete an element
elementsRouter.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    const element = await prisma.element.findUnique({ where: { id } });
    if (!element) {
      return c.json({ error: "Element not found" }, 404);
    }

    await prisma.element.delete({ where: { id } });

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting element:", error);
    return c.json({ error: "Failed to delete element" }, 500);
  }
});

export { elementsRouter };

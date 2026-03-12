import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const youtubeRouter = new Hono();

const SERP_API_KEY = "384ad44f619971016c275897440ef863efb4fb05e437d1a1bb0e47efbec2f243";

// Schema for request validation
const youtubeThumbnailSchema = z.object({
  youtubeUrl: z.string().url("Invalid URL format"),
});

// Extract video ID from various YouTube URL formats
function extractVideoId(url: string): string | null {
  const patterns = [
    // https://www.youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    // https://youtu.be/VIDEO_ID
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // https://www.youtube.com/embed/VIDEO_ID
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    // https://www.youtube.com/v/VIDEO_ID
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    // https://www.youtube.com/shorts/VIDEO_ID
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

// POST /api/youtube-thumbnail
youtubeRouter.post(
  "/thumbnail",
  zValidator("json", youtubeThumbnailSchema),
  async (c) => {
    const { youtubeUrl } = c.req.valid("json");

    // Extract video ID from the URL
    const videoId = extractVideoId(youtubeUrl);

    if (!videoId) {
      return c.json(
        { error: "Invalid YouTube URL. Could not extract video ID." },
        400
      );
    }

    try {
      // Call SERP API
      const serpUrl = `https://serpapi.com/search?engine=youtube_video&v=${videoId}&api_key=${SERP_API_KEY}`;
      const response = await fetch(serpUrl);

      if (!response.ok) {
        return c.json(
          { error: "Failed to fetch video information from SERP API" },
          502
        );
      }

      const data = await response.json();

      // Extract thumbnail and title from response
      const thumbnailUrl =
        data.thumbnail?.static ||
        data.thumbnail?.url ||
        `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

      const title = data.title || undefined;

      return c.json({
        thumbnailUrl,
        videoId,
        title,
      });
    } catch (error) {
      console.error("Error fetching YouTube thumbnail:", error);
      return c.json(
        { error: "An error occurred while fetching the video thumbnail" },
        500
      );
    }
  }
);

export { youtubeRouter };

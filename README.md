# Thumbnail Studio

A web app for creating high-quality thumbnails using Nano Banana Pro (Gemini image generation). Features a quick-reference system for commonly used assets called "Elements" that can be triggered with @mentions.

## Features

- **AI-Powered Thumbnail Generation**: Generate thumbnails using Nano Banana Pro API
- **Elements System**: Save and quickly reference commonly used images with @mentions (e.g., @Riley, @intensethumbnail)
- **Multiple Aspect Ratios**: Support for 16:9, 9:16, 1:1, 4:3, and 3:4 aspect ratios
- **Reference Images**: Add additional images to your prompts for better results
- **Fullscreen Viewer**: Click on generated images to view in fullscreen and download
- **Paginated Loading**: Elements and generations load in batches for faster initial load times

## How to Use

1. **Generate Thumbnails**: Type a prompt in the input field at the bottom of the screen and click "Generate"
2. **Add Elements**: Go to the Elements page (top right button) to save commonly used images
3. **Use @Mentions**: Type `@` followed by an element name to reference saved assets (e.g., "Create an image of @Riley in the style of @intensethumbnail")
4. **Add Images**: Click "Add Images" to include additional reference images with your prompt
5. **Download**: Click on any generated image to view it fullscreen and download it

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS + Framer Motion
- **Backend**: Hono + Bun
- **Image Generation**: Nano Banana Pro (Gemini 3 Pro Image Preview)

# Thumbnail Studio

A hosted thumbnail app for creating, saving, copying, and editing YouTube thumbnails with GPT Image 2. It keeps the Krea-style Riley Studio interface and stores generated thumbnails plus Elements in a Chorus Worker KV namespace.

## Features

- **AI-Powered Thumbnail Generation**: Generate thumbnails using `gpt-image-2`
- **In-App Image Edits**: Edit any saved thumbnail with GPT Image 2 and save the result back into the grid
- **Clipboard Copy**: Copy generated thumbnails directly from the grid or fullscreen viewer
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
5. **Edit**: Hover a thumbnail and click the wand, or open fullscreen and click Edit
6. **Copy or Download**: Copy thumbnails to the clipboard or download them from the fullscreen viewer

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS + Framer Motion
- **Hosted Backend**: Chorus Worker
- **Storage**: Chorus KV namespace (`THUMBNAILS`)
- **Image Generation**: OpenAI `gpt-image-2`

## Hosted URLs

- App: https://riley-thumbnail-studio.chorus.host
- API: https://riley-thumbnail-api.worker.chorus.host

## Deployment

Store secrets outside the repo:

```bash
security add-generic-password -U -s codex-chorus-api-key -a rileybrown -w "$CHORUS_API_KEY"
```

Deploy the Worker, build the frontend, publish the site, and seed existing thumbnails:

```bash
CHORUS_API_KEY="$(security find-generic-password -s codex-chorus-api-key -a rileybrown -w)" OPENAI_API_KEY="$OPENAI_API_KEY" node scripts/deploy-chorus-worker.mjs
cd webapp && bun run build
cd ..
CHORUS_API_KEY="$(security find-generic-password -s codex-chorus-api-key -a rileybrown -w)" node scripts/publish-chorus-site.mjs
node scripts/seed-thumbnails.mjs
```

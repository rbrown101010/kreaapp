import { useState, useRef, useEffect, KeyboardEvent, DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ImagePlus, Grid3X3, Download, X, Loader2, GripVertical, CornerDownLeft, Sparkles, ChevronLeft, ChevronRight, ImageDown, Star, CheckSquare, Upload, Youtube } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Element {
  id: string;
  name: string;
  imageBase64: string;
  mimeType: string;
  color: string;
  createdAt: string;
}

interface GeneratedImage {
  id: string;
  base64: string;
  prompt: string;
  favorite: boolean;
  createdAt: Date;
}

interface PendingGeneration {
  id: string;
  prompt: string;
  startedAt: Date;
}

interface ReferenceImage {
  id: string;
  name: string;
  imageBase64: string;
  mimeType: string;
  preview: string;
  source: "file" | "generated" | "youtube";
}

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 (Landscape)" },
  { value: "9:16", label: "9:16 (Portrait)" },
  { value: "1:1", label: "1:1 (Square)" },
  { value: "4:3", label: "4:3 (Standard)" },
  { value: "3:4", label: "3:4 (Portrait)" },
];

const GENERATIONS_PAGE_LIMIT = 12;

const Index = () => {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [elements, setElements] = useState<Element[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [pendingGenerations, setPendingGenerations] = useState<PendingGeneration[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [imagesOffset, setImagesOffset] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [showMentions, setShowMentions] = useState(false);
  const [showElementsPicker, setShowElementsPicker] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [viewingImage, setViewingImage] = useState<GeneratedImage | null>(null);
  const [isHoveringViewer, setIsHoveringViewer] = useState(false);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [fullscreenReferenceImage, setFullscreenReferenceImage] = useState<ReferenceImage | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  // Add Images Dialog state
  const [isAddImagesDialogOpen, setIsAddImagesDialogOpen] = useState(false);
  const [addImagesInputMode, setAddImagesInputMode] = useState<"upload" | "youtube">("upload");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isFetchingThumbnail, setIsFetchingThumbnail] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [youtubeThumbnailPreview, setYoutubeThumbnailPreview] = useState<{
    base64: string;
    mimeType: string;
    preview: string;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    fetchElements();
    fetchGeneratedImages(0, true);
  }, []);

  const fetchElements = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/elements`);
      if (res.ok) {
        const data = await res.json();
        setElements(data.elements || []);
      }
    } catch (error) {
      console.error("Failed to fetch elements:", error);
    }
  };

  const fetchGeneratedImages = async (currentOffset: number, isInitial: boolean = false) => {
    if (isInitial) {
      setIsLoadingImages(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const res = await fetch(`${backendUrl}/api/generate?limit=${GENERATIONS_PAGE_LIMIT}&offset=${currentOffset}`);
      if (res.ok) {
        const data = await res.json();
        const images = (data.images || []).map((img: { id: string; imageBase64: string; prompt: string; favorite: boolean; createdAt: string }) => ({
          id: img.id,
          base64: img.imageBase64,
          prompt: img.prompt,
          favorite: img.favorite || false,
          createdAt: new Date(img.createdAt),
        }));

        if (isInitial) {
          setGeneratedImages(images);
        } else {
          setGeneratedImages((prev) => [...prev, ...images]);
        }

        setTotalImages(data.total || 0);
        setHasMore(images.length === GENERATIONS_PAGE_LIMIT);
        setImagesOffset(currentOffset + images.length);
      }
    } catch (error) {
      console.error("Failed to fetch generated images:", error);
    } finally {
      setIsLoadingImages(false);
      setIsLoadingMore(false);
    }
  };

  const loadMoreImages = () => {
    if (!isLoadingMore && hasMore) {
      fetchGeneratedImages(imagesOffset, false);
    }
  };

  const toggleFavorite = async (imageId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    try {
      const res = await fetch(`${backendUrl}/api/generate/${imageId}/favorite`, {
        method: "PATCH",
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedImages((prev) =>
          prev.map((img) =>
            img.id === imageId ? { ...img, favorite: data.favorite } : img
          )
        );
        // Also update viewingImage if it's the same image
        if (viewingImage?.id === imageId) {
          setViewingImage((prev) => prev ? { ...prev, favorite: data.favorite } : null);
        }
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
      toast.error("Failed to update favorite");
    }
  };

  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    setSelectedImages(new Set());
  };

  const toggleImageSelection = (imageId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedImages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  const downloadSelectedImages = async () => {
    if (selectedImages.size === 0) {
      toast.error("No images selected");
      return;
    }

    const imagesToDownload = generatedImages.filter((img) => selectedImages.has(img.id));

    for (const image of imagesToDownload) {
      const link = document.createElement("a");
      link.href = `data:image/png;base64,${image.base64}`;
      link.download = `${image.prompt.slice(0, 30).replace(/[^a-z0-9]/gi, "_")}_${image.id.slice(0, 8)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Small delay between downloads
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    toast.success(`Downloaded ${imagesToDownload.length} image${imagesToDownload.length > 1 ? "s" : ""}`);
    setSelectMode(false);
    setSelectedImages(new Set());
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setPrompt(value);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(" ")) {
        setMentionFilter(textAfterAt.toLowerCase());
        setShowMentions(true);
        setSelectedMentionIndex(0);

        if (textareaRef.current) {
          const rect = textareaRef.current.getBoundingClientRect();
          setMentionPosition({
            top: rect.top - 200,
            left: rect.left,
          });
        }
        return;
      }
    }
    setShowMentions(false);
  };

  const filteredElements = elements.filter((el) =>
    el.name.toLowerCase().includes(mentionFilter)
  );

  const insertMention = (element: Element) => {
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = prompt.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    const textAfterCursor = prompt.slice(cursorPosition);

    const newPrompt =
      textBeforeCursor.slice(0, lastAtIndex) + `@${element.name}` + textAfterCursor;
    setPrompt(newPrompt);
    setShowMentions(false);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredElements.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev < filteredElements.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev > 0 ? prev - 1 : filteredElements.length - 1
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredElements[selectedMentionIndex]);
      } else if (e.key === "Escape") {
        setShowMentions(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      // Submit on Enter (Shift+Enter for new line)
      e.preventDefault();
      if (prompt.trim()) {
        handleGenerate();
      }
    }
  };

  // Check if a string looks like a YouTube URL
  const isYoutubeUrl = (url: string): boolean => {
    const patterns = [
      /youtube\.com\/watch/,
      /youtu\.be\//,
      /youtube\.com\/embed/,
      /youtube\.com\/v\//,
      /youtube\.com\/shorts/,
    ];
    return patterns.some((pattern) => pattern.test(url));
  };

  const handleFetchYoutubeThumbnail = async (urlToFetch?: string) => {
    const url = urlToFetch || youtubeUrl;
    if (!url.trim()) return;

    setIsFetchingThumbnail(true);
    setYoutubeError(null);

    try {
      // Call backend to get thumbnail URL
      const res = await fetch(`${backendUrl}/api/youtube/thumbnail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: url.trim() }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch thumbnail");
      }

      const data = await res.json();
      const thumbnailUrl = data.thumbnailUrl;

      // Fetch the thumbnail image and convert to base64
      const imgRes = await fetch(thumbnailUrl);
      if (!imgRes.ok) {
        throw new Error("Failed to fetch thumbnail image");
      }

      const blob = await imgRes.blob();
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        setYoutubeThumbnailPreview({
          base64,
          mimeType: blob.type || "image/jpeg",
          preview: result,
        });
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Failed to fetch YouTube thumbnail:", error);
      setYoutubeError(error instanceof Error ? error.message : "Invalid YouTube URL");
    } finally {
      setIsFetchingThumbnail(false);
    }
  };

  // Handle YouTube URL input change with auto-fetch
  const handleYoutubeUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setYoutubeUrl(value);
    setYoutubeError(null);

    // Auto-fetch if it looks like a valid YouTube URL
    if (isYoutubeUrl(value)) {
      handleFetchYoutubeThumbnail(value);
    }
  };

  const resetAddImagesDialogState = () => {
    setAddImagesInputMode("upload");
    setYoutubeUrl("");
    setYoutubeError(null);
    setYoutubeThumbnailPreview(null);
  };

  const handleAddYoutubeThumbnail = () => {
    if (!youtubeThumbnailPreview) return;

    const newRef: ReferenceImage = {
      id: Date.now().toString() + Math.random(),
      name: "YouTube Thumbnail",
      imageBase64: youtubeThumbnailPreview.base64,
      mimeType: youtubeThumbnailPreview.mimeType,
      preview: youtubeThumbnailPreview.preview,
      source: "youtube",
    };
    setReferenceImages((prev) => [...prev, newRef]);
    setIsAddImagesDialogOpen(false);
    resetAddImagesDialogState();
    toast.success("YouTube thumbnail added as reference");
  };

  const handleDialogFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          const newRef: ReferenceImage = {
            id: Date.now().toString() + Math.random(),
            name: file.name,
            imageBase64: base64,
            mimeType: file.type,
            preview: result,
            source: "file",
          };
          setReferenceImages((prev) => [...prev, newRef]);
        };
        reader.readAsDataURL(file);
      });
      setIsAddImagesDialogOpen(false);
      resetAddImagesDialogState();
    }
    e.target.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          const newRef: ReferenceImage = {
            id: Date.now().toString() + Math.random(),
            name: file.name,
            imageBase64: base64,
            mimeType: file.type,
            preview: result,
            source: "file",
          };
          setReferenceImages((prev) => [...prev, newRef]);
        };
        reader.readAsDataURL(file);
      });
    }
    e.target.value = "";
  };

  const removeReferenceImage = (id: string) => {
    setReferenceImages((prev) => prev.filter((img) => img.id !== id));
  };

  const extractMentionedElements = (): Element[] => {
    const mentions = prompt.match(/@(\w+)/g) || [];
    const mentionedNames = mentions.map((m) => m.slice(1).toLowerCase());
    return elements.filter((el) =>
      mentionedNames.includes(el.name.toLowerCase())
    );
  };

  // Handle drag start from generated images
  const handleDragStart = (e: DragEvent<HTMLDivElement>, image: GeneratedImage) => {
    e.dataTransfer.setData("application/json", JSON.stringify({
      type: "generated-image",
      id: image.id,
      base64: image.base64,
      prompt: image.prompt,
    }));
    e.dataTransfer.effectAllowed = "copy";
  };

  // Handle drag over the input area
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  // Handle drop on the input area
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const data = e.dataTransfer.getData("application/json");
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "generated-image") {
          const newRef: ReferenceImage = {
            id: Date.now().toString() + Math.random(),
            name: `Generated: ${parsed.prompt.slice(0, 20)}...`,
            imageBase64: parsed.base64,
            mimeType: "image/png",
            preview: `data:image/png;base64,${parsed.base64}`,
            source: "generated",
          };
          setReferenceImages((prev) => [...prev, newRef]);
          toast.success("Image added as reference");
        }
      } catch (err) {
        console.error("Failed to parse drag data:", err);
      }
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    const generationId = Date.now().toString();
    const currentPrompt = prompt;
    const currentAspectRatio = aspectRatio;
    const currentReferenceImages = [...referenceImages];
    const mentionedElements = extractMentionedElements();

    // Add to pending generations
    setPendingGenerations((prev) => [
      { id: generationId, prompt: currentPrompt, startedAt: new Date() },
      ...prev,
    ]);

    // Build reference images array
    const allReferenceImages: { name: string; imageBase64: string; mimeType: string }[] = [];

    for (const el of mentionedElements) {
      allReferenceImages.push({
        name: el.name,
        imageBase64: el.imageBase64,
        mimeType: el.mimeType,
      });
    }

    for (const img of currentReferenceImages) {
      allReferenceImages.push({
        name: img.name,
        imageBase64: img.imageBase64,
        mimeType: img.mimeType,
      });
    }

    // Fire and forget - don't await
    (async () => {
      try {
        const res = await fetch(`${backendUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: currentPrompt,
            aspectRatio: currentAspectRatio,
            referenceImages: allReferenceImages,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || "Generation failed");
        }

        const data = await res.json();

        const newImage: GeneratedImage = {
          id: data.id,
          base64: data.image,
          prompt: currentPrompt,
          favorite: false,
          createdAt: new Date(),
        };

        // Remove from pending and add to generated
        setPendingGenerations((prev) => prev.filter((p) => p.id !== generationId));
        setGeneratedImages((prev) => [newImage, ...prev]);
        toast.success("Thumbnail generated!");
      } catch (error) {
        console.error("Generation error:", error);
        setPendingGenerations((prev) => prev.filter((p) => p.id !== generationId));
        toast.error("Failed to generate image. Please try again.");
      }
    })();
  };

  const downloadImage = (image: GeneratedImage) => {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${image.base64}`;
    link.download = `thumbnail-${image.id}.png`;
    link.click();
  };

  const insertImageAsReference = (image: GeneratedImage) => {
    const newRef: ReferenceImage = {
      id: Date.now().toString() + Math.random(),
      name: `Generated: ${image.prompt.slice(0, 20)}...`,
      imageBase64: image.base64,
      mimeType: "image/png",
      preview: `data:image/png;base64,${image.base64}`,
      source: "generated",
    };
    setReferenceImages((prev) => [...prev, newRef]);
    setViewingImage(null);
    toast.success("Image added as reference");
  };

  const navigateViewer = (direction: "prev" | "next") => {
    if (!viewingImage) return;
    const currentIndex = generatedImages.findIndex((img) => img.id === viewingImage.id);
    if (currentIndex === -1) return;

    let newIndex: number;
    if (direction === "prev") {
      newIndex = currentIndex > 0 ? currentIndex - 1 : generatedImages.length - 1;
    } else {
      newIndex = currentIndex < generatedImages.length - 1 ? currentIndex + 1 : 0;
    }
    setViewingImage(generatedImages[newIndex]);
  };

  // Keyboard handler for viewer navigation
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Handle escape for fullscreen reference image
      if (e.key === "Escape" && fullscreenReferenceImage) {
        setFullscreenReferenceImage(null);
        return;
      }

      if (!viewingImage) return;
      if (e.key === "ArrowLeft") {
        navigateViewer("prev");
      } else if (e.key === "ArrowRight") {
        navigateViewer("next");
      } else if (e.key === "Escape") {
        setViewingImage(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewingImage, generatedImages, fullscreenReferenceImage]);

  const isGenerating = pendingGenerations.length > 0;

  return (
    <div className="min-h-screen bg-[#131316] text-white font-['Geist',sans-serif] relative">
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Pacifico&display=swap');
      `}</style>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-white/5 bg-[#131316]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-2">
          <div className="flex items-center gap-3">
            <span className="text-xl tracking-tight" style={{ fontFamily: "'Pacifico', cursive" }}>Riley Studio</span>
            {totalImages > 0 && (
              <span className="text-xs font-medium text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                {totalImages} {totalImages === 1 ? 'image' : 'images'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectMode ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:text-white hover:bg-white/5"
                  onClick={toggleSelectMode}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-black"
                  onClick={downloadSelectedImages}
                  disabled={selectedImages.size === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download ({selectedImages.size})
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:text-white hover:bg-white/5"
                  onClick={toggleSelectMode}
                >
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Select
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`hover:bg-white/5 ${showFavoritesOnly ? "text-amber-400" : "text-white/60 hover:text-white"}`}
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                >
                  <Star className={`w-4 h-4 mr-2 ${showFavoritesOnly ? "fill-amber-400" : ""}`} />
                  Favorites
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:text-white hover:bg-white/5"
                  onClick={() => navigate("/elements")}
                >
                  <Grid3X3 className="w-4 h-4 mr-2" />
                  Elements
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-14 pb-48 relative z-10">
        {/* Generated Images Grid */}
        <div className="px-6 py-8">
          {isLoadingImages ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-video">
                  <Skeleton className="w-full h-full rounded-xl bg-white/5" />
                </div>
              ))}
            </div>
          ) : generatedImages.length === 0 && pendingGenerations.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
              <img src="/logo.png" alt="Riley Studio" className="w-24 h-24 rounded-2xl object-cover mb-6 opacity-60" />
              <h2 className="text-xl font-medium text-white/60 mb-2">What do you want to create?</h2>
              <p className="text-white/30 text-sm max-w-md">
                Type a prompt below and hit enter. Use @mentions to reference your saved elements.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {/* Pending generations show as loading skeletons */}
                {pendingGenerations.map((pending) => (
                  <motion.div
                    key={pending.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    layout
                    className="aspect-video bg-white/5 rounded-xl overflow-hidden relative"
                  >
                    <Skeleton className="w-full h-full bg-white/10" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <div className="flex items-center gap-3 bg-black/50 px-4 py-2 rounded-full">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        <span className="text-sm text-white/80">Generating...</span>
                      </div>
                      <p className="text-xs text-white/40 max-w-[80%] text-center line-clamp-1">
                        {pending.prompt}
                      </p>
                    </div>
                  </motion.div>
                ))}
                {/* Generated images */}
                {generatedImages
                  .filter((image) => !showFavoritesOnly || image.favorite)
                  .map((image) => (
                  <motion.div
                    key={image.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    layout
                    draggable={!selectMode}
                    onDragStart={(e) => !selectMode && handleDragStart(e as unknown as DragEvent<HTMLDivElement>, image)}
                    className={`aspect-video bg-white/5 rounded-xl overflow-hidden group relative ${
                      selectMode
                        ? `cursor-pointer ${selectedImages.has(image.id) ? "ring-2 ring-amber-400" : ""}`
                        : "cursor-grab active:cursor-grabbing"
                    }`}
                    onClick={() => selectMode ? toggleImageSelection(image.id) : setViewingImage(image)}
                  >
                    <img
                      src={`data:image/png;base64,${image.base64}`}
                      alt={image.prompt}
                      className="w-full h-full object-contain pointer-events-none"
                    />
                    {/* Selection checkbox - top left in select mode */}
                    {selectMode && (
                      <div
                        className={`absolute top-2 left-2 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                          selectedImages.has(image.id)
                            ? "bg-amber-400 border-amber-400"
                            : "border-white/40 bg-black/40"
                        }`}
                      >
                        {selectedImages.has(image.id) && (
                          <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    )}
                    {/* Star button - top right (hide in select mode) */}
                    {!selectMode && (
                      <button
                        onClick={(e) => toggleFavorite(image.id, e)}
                        className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          image.favorite
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-black/60 text-white/60 opacity-0 group-hover:opacity-100 hover:text-amber-400"
                        }`}
                      >
                        <Star className={`w-4 h-4 ${image.favorite ? "fill-amber-400" : ""}`} />
                      </button>
                    )}
                    {!selectMode && (
                      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-black/60 rounded-md p-1.5 flex items-center gap-1">
                          <GripVertical className="w-3 h-3 text-white/60" />
                          <span className="text-xs text-white/60">Drag to use</span>
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="text-sm text-white/80 line-clamp-2">{image.prompt}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          {/* Load More Button */}
          {generatedImages.length > 0 && hasMore && !showFavoritesOnly && (
            <div className="flex justify-center mt-8">
              <Button
                onClick={loadMoreImages}
                disabled={isLoadingMore}
                variant="outline"
                className="bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load More"
                )}
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Input Area */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#131316] via-[#131316] to-transparent pt-12 pb-6 px-6 transition-colors z-20 ${
          isDraggingOver ? "bg-amber-500/10" : ""
        }`}
      >
        {/* Drop zone indicator */}
        {isDraggingOver && (
          <div className="max-w-3xl mx-auto mb-3">
            <div className="border-2 border-dashed border-amber-400 rounded-xl p-4 text-center bg-amber-400/10">
              <p className="text-amber-400 font-medium">Drop image here to add as reference</p>
            </div>
          </div>
        )}

        {/* Reference Images Preview */}
        {referenceImages.length > 0 && !isDraggingOver && (
          <div className={`max-w-3xl mx-auto mb-2 flex ${fullscreenReferenceImage ? "justify-center" : "justify-start"}`}>
            {/* Expanded image view - anchored to bottom, expands upward */}
            {fullscreenReferenceImage ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className="relative border-2 border-white/30 rounded-lg p-2 bg-[#1a1a1c]"
              >
                <img
                  src={fullscreenReferenceImage.preview}
                  alt={fullscreenReferenceImage.name}
                  className="max-h-[50vh] max-w-[80vw] w-auto object-contain rounded cursor-pointer"
                  onDoubleClick={() => setFullscreenReferenceImage(null)}
                  title="Double-click to minimize"
                />
                <button
                  onClick={() => setFullscreenReferenceImage(null)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </motion.div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {referenceImages.map((img) => (
                  <div key={img.id} className="relative flex-shrink-0 border-2 border-white/20 rounded-lg p-1 bg-white/5 group/refimg">
                    <img
                      src={img.preview}
                      alt={img.name}
                      className="h-20 w-auto object-contain rounded cursor-pointer transition-opacity group-hover/refimg:opacity-80"
                      onDoubleClick={() => setFullscreenReferenceImage(img)}
                      title="Double-click to enlarge"
                    />
                    {/* Hover hint for double-click */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/refimg:opacity-100 transition-opacity pointer-events-none">
                      <span className="text-[9px] text-white bg-black/70 px-1.5 py-0.5 rounded whitespace-nowrap">Double-click to enlarge</span>
                    </div>
                    <button
                      onClick={() => removeReferenceImage(img.id)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {img.source === "generated" && (
                      <div className="absolute bottom-1 left-1 right-1 bg-black/60 text-[9px] text-center text-white/80 py-0.5 rounded">
                        Generated
                      </div>
                    )}
                    {img.source === "youtube" && (
                      <div className="absolute bottom-1 left-1 right-1 bg-red-500/80 text-[9px] text-center text-white py-0.5 rounded flex items-center justify-center gap-1">
                        <Youtube className="w-2.5 h-2.5" />
                        YouTube
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mentions Dropdown */}
        <AnimatePresence>
          {showMentions && filteredElements.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="max-w-3xl mx-auto mb-2"
            >
              <div className="bg-[#1a1a1c] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                <div className="p-2 border-b border-white/5">
                  <span className="text-xs text-white/40 px-2">Elements</span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredElements.map((element, index) => (
                    <button
                      key={element.id}
                      className={`w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors ${
                        index === selectedMentionIndex ? "bg-white/10" : ""
                      }`}
                      onClick={() => insertMention(element)}
                    >
                      <img
                        src={`data:${element.mimeType};base64,${element.imageBase64}`}
                        alt={element.name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                      <span className="font-medium" style={{ color: element.color }}>@{element.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Elements Picker (same style as @ mentions) */}
        <AnimatePresence>
          {showElementsPicker && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="max-w-3xl mx-auto mb-2"
            >
              <div className="bg-[#1a1a1c] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                <div className="p-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-sm font-medium text-white">Your Elements</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigate("/elements")}
                      className="text-xs text-amber-400 hover:underline"
                    >
                      Manage
                    </button>
                    <button
                      onClick={() => setShowElementsPicker(false)}
                      className="text-white/40 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {elements.length === 0 ? (
                  <div className="p-8 text-center text-white/40 text-sm">
                    No elements yet.{" "}
                    <button
                      onClick={() => navigate("/elements")}
                      className="text-amber-400 hover:underline"
                    >
                      Add some
                    </button>
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {elements.map((element) => (
                        <button
                          key={element.id}
                          className="flex flex-col gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                          onClick={() => {
                            setPrompt((prev) => prev + `@${element.name} `);
                            setShowElementsPicker(false);
                            textareaRef.current?.focus();
                          }}
                        >
                          <div className="w-full aspect-video bg-black/20 rounded-md overflow-hidden">
                            <img
                              src={`data:${element.mimeType};base64,${element.imageBase64}`}
                              alt={element.name}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span className="text-xs font-medium truncate w-full text-left" style={{ color: element.color }}>@{element.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-3xl mx-auto">
          <div className={`bg-[#1a1a1c] rounded-2xl p-3 transition-all ${isInputFocused ? 'border-2 border-white/50' : 'border border-white/10'}`}>
            {/* Custom textarea with colored mentions */}
            <div className="relative min-h-[60px]">
              {/* Colored overlay - displays the styled text */}
              <div
                className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-words overflow-hidden px-3 py-2"
                style={{
                  fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                  fontSize: "16px",
                  lineHeight: "24px",
                  letterSpacing: "normal",
                  wordSpacing: "normal"
                }}
                aria-hidden="true"
              >
                {prompt.split(/(@\w+)/g).map((part, index) => {
                  if (part.startsWith("@")) {
                    const elementName = part.slice(1).toLowerCase();
                    const element = elements.find(
                      (el) => el.name.toLowerCase() === elementName
                    );
                    return (
                      <span
                        key={index}
                        style={{ color: element?.color || "#F59E0B" }}
                      >
                        {part}
                      </span>
                    );
                  }
                  return <span key={index} style={{ color: "#ffffff" }}>{part}</span>;
                })}
                {!prompt && <span style={{ color: "rgba(255,255,255,0.3)" }}>Describe your thumbnail... Use @element to reference saved assets</span>}
              </div>
              {/* Actual textarea - transparent text */}
              <Textarea
                ref={textareaRef}
                value={prompt}
                onChange={handlePromptChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                placeholder=""
                className="relative bg-transparent border-0 resize-none text-transparent caret-white placeholder:text-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:ring-0 outline-none ring-0 min-h-[60px] px-3 py-2"
                style={{
                  caretColor: "white",
                  fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                  fontSize: "16px",
                  lineHeight: "24px",
                  letterSpacing: "normal",
                  wordSpacing: "normal"
                }}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
                <Popover
                  open={isAddImagesDialogOpen}
                  onOpenChange={(open) => {
                    setIsAddImagesDialogOpen(open);
                    if (!open) resetAddImagesDialogState();
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      className="bg-white/10 hover:bg-white/15 text-white/70 hover:text-white border-0 text-xs"
                    >
                      <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
                      Add Images
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="start"
                    sideOffset={100}
                    className="w-80 bg-[#1a1a1c] border-white/10 p-3"
                  >
                    <Tabs
                      value={addImagesInputMode}
                      onValueChange={(v) => {
                        setAddImagesInputMode(v as "upload" | "youtube");
                        setYoutubeThumbnailPreview(null);
                        setYoutubeError(null);
                      }}
                    >
                      <TabsList className="grid w-full grid-cols-2 bg-white/5 h-8">
                        <TabsTrigger
                          value="upload"
                          className="text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-400 data-[state=active]:to-orange-500 data-[state=active]:text-black"
                        >
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                          Computer
                        </TabsTrigger>
                        <TabsTrigger
                          value="youtube"
                          className="text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white"
                        >
                          <Youtube className="w-3.5 h-3.5 mr-1.5" />
                          YouTube
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="upload" className="mt-3">
                        <input
                          type="file"
                          onChange={handleDialogFileSelect}
                          accept="image/*"
                          multiple
                          className="hidden"
                          id="popover-file-input"
                        />
                        <label
                          htmlFor="popover-file-input"
                          className="w-full h-28 border-2 border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-white/20 transition-colors cursor-pointer"
                        >
                          <Upload className="w-6 h-6 text-white/40" />
                          <span className="text-white/40 text-xs">Click to upload</span>
                        </label>
                      </TabsContent>

                      <TabsContent value="youtube" className="mt-3 space-y-3">
                        {isFetchingThumbnail ? (
                          <div className="w-full py-6 rounded-lg bg-white/5 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
                              <span className="text-white/40 text-xs">Fetching thumbnail...</span>
                            </div>
                          </div>
                        ) : youtubeThumbnailPreview ? (
                          <div className="space-y-3">
                            <div className="relative">
                              <img
                                src={youtubeThumbnailPreview.preview}
                                alt="YouTube Thumbnail"
                                className="w-full h-auto object-contain rounded-lg"
                              />
                              <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-red-500 rounded text-[10px] text-white flex items-center gap-1">
                                <Youtube className="w-2.5 h-2.5" />
                                YouTube
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => {
                                  setYoutubeThumbnailPreview(null);
                                  setYoutubeUrl("");
                                }}
                                size="sm"
                                variant="outline"
                                className="flex-1 border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-xs h-8"
                              >
                                <X className="w-3 h-3 mr-1.5" />
                                Clear
                              </Button>
                              <Button
                                onClick={handleAddYoutubeThumbnail}
                                size="sm"
                                className="flex-1 bg-gradient-to-r from-amber-400 to-orange-500 text-black font-semibold hover:from-amber-500 hover:to-orange-600 text-xs h-8"
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <Input
                              value={youtubeUrl}
                              onChange={handleYoutubeUrlChange}
                              placeholder="Paste YouTube URL..."
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-8 text-xs"
                            />
                            {youtubeError && (
                              <p className="text-xs text-red-400">{youtubeError}</p>
                            )}
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </PopoverContent>
                </Popover>

                <Button
                  size="sm"
                  onClick={() => setShowElementsPicker(!showElementsPicker)}
                  className="bg-white/10 hover:bg-white/15 text-white/70 hover:text-white border-0 text-xs"
                >
                  <Grid3X3 className="w-3.5 h-3.5 mr-1.5" />
                  Elements
                </Button>

                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger className="w-[160px] h-8 bg-transparent border-white/10 text-white/60 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1c] border-white/10">
                    {ASPECT_RATIOS.map((ratio) => (
                      <SelectItem
                        key={ratio.value}
                        value={ratio.value}
                        className="text-white hover:bg-white/5 text-xs"
                      >
                        {ratio.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                {isGenerating && (
                  <span className="text-xs text-white/40">
                    {pendingGenerations.length} generating...
                  </span>
                )}
                <Button
                  onClick={handleGenerate}
                  disabled={!prompt.trim()}
                  className="bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-50"
                >
                  <CornerDownLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Image Viewer */}
      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="max-w-5xl bg-[#131316] border-white/10 p-0 overflow-hidden">
          {viewingImage && (
            <div
              className="relative"
              onMouseEnter={() => setIsHoveringViewer(true)}
              onMouseLeave={() => setIsHoveringViewer(false)}
            >
              {/* Left Arrow */}
              {generatedImages.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateViewer("prev");
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
              )}

              {/* Right Arrow */}
              {generatedImages.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateViewer("next");
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>
              )}

              {/* Favorite Button - Top Right */}
              {(() => {
                const currentImage = generatedImages.find(img => img.id === viewingImage.id);
                const isFavorite = currentImage?.favorite || false;
                return (
                  <button
                    onClick={(e) => toggleFavorite(viewingImage.id, e)}
                    className={`absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isFavorite
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-black/40 hover:bg-black/60 text-white/60 hover:text-amber-400"
                    }`}
                  >
                    <Star className={`w-5 h-5 ${isFavorite ? "fill-amber-400" : ""}`} />
                  </button>
                );
              })()}

              <img
                src={`data:image/png;base64,${viewingImage.base64}`}
                alt={viewingImage.prompt}
                className="w-full h-auto max-h-[80vh] object-contain"
              />

              {/* Action Buttons - Bottom Right */}
              <div className="absolute bottom-4 right-4 flex items-center gap-2 z-10">
                {isHoveringViewer ? (
                  <>
                    <Button
                      onClick={() => downloadImage(viewingImage)}
                      variant="secondary"
                      size="sm"
                      className="bg-black/60 hover:bg-black/80 text-white border-0"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      onClick={() => insertImageAsReference(viewingImage)}
                      variant="secondary"
                      size="sm"
                      className="bg-black/60 hover:bg-black/80 text-white border-0"
                    >
                      <ImageDown className="w-4 h-4 mr-2" />
                      Insert into prompt
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="p-2 rounded-md">
                      <Download className="w-4 h-4 text-white/30" />
                    </div>
                    <div className="p-2 rounded-md">
                      <ImageDown className="w-4 h-4 text-white/30" />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Index;

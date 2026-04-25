import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Trash2, Upload, Sparkles, ImageIcon, Youtube, Loader2, Pencil, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Element {
  id: string;
  name: string;
  imageBase64: string;
  mimeType: string;
  color: string;
  createdAt: string;
}

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

const ELEMENTS_PAGE_LIMIT = 20;

const Elements = () => {
  const navigate = useNavigate();
  const [elements, setElements] = useState<Element[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [elementToDelete, setElementToDelete] = useState<Element | null>(null);
  const [newElementName, setNewElementName] = useState("");
  const [newElementImage, setNewElementImage] = useState<{
    base64: string;
    mimeType: string;
    preview: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // YouTube state
  const [inputMode, setInputMode] = useState<"upload" | "youtube">("upload");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isFetchingThumbnail, setIsFetchingThumbnail] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

  // Edit state
  const [editingElement, setEditingElement] = useState<Element | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://riley-thumbnail-api.worker.chorus.host";

  useEffect(() => {
    fetchElements(0, true);
  }, []);

  const fetchElements = async (currentOffset: number, isInitial: boolean = false) => {
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const res = await fetch(`${backendUrl}/api/elements?limit=${ELEMENTS_PAGE_LIMIT}&offset=${currentOffset}`);
      if (res.ok) {
        const data = await res.json();
        const fetchedElements = data.elements || [];

        if (isInitial) {
          setElements(fetchedElements);
        } else {
          setElements((prev) => [...prev, ...fetchedElements]);
        }

        setHasMore(fetchedElements.length === ELEMENTS_PAGE_LIMIT);
        setOffset(currentOffset + fetchedElements.length);
      }
    } catch (error) {
      console.error("Failed to fetch elements:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchElements(offset, false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        setNewElementImage({
          base64,
          mimeType: file.type,
          preview: result,
        });
      };
      reader.readAsDataURL(file);
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
        setNewElementImage({
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

  const resetDialogState = () => {
    setNewElementName("");
    setNewElementImage(null);
    setInputMode("upload");
    setYoutubeUrl("");
    setYoutubeError(null);
  };

  const handleAddElement = async () => {
    if (!newElementName.trim() || !newElementImage) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${backendUrl}/api/elements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newElementName.trim().replace(/\s+/g, ""),
          imageBase64: newElementImage.base64,
          mimeType: newElementImage.mimeType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setElements((prev) => [data.element, ...prev]);
        setIsAddDialogOpen(false);
        resetDialogState();
      }
    } catch (error) {
      console.error("Failed to add element:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteElement = async () => {
    if (!elementToDelete) return;

    try {
      const res = await fetch(`${backendUrl}/api/elements/${elementToDelete.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setElements((prev) => prev.filter((el) => el.id !== elementToDelete.id));
      }
    } catch (error) {
      console.error("Failed to delete element:", error);
    } finally {
      setElementToDelete(null);
    }
  };

  const handleStartEdit = (element: Element) => {
    setEditingElement(element);
    setEditName(element.name);
    setEditColor(element.color);
  };

  const handleCancelEdit = () => {
    setEditingElement(null);
    setEditName("");
    setEditColor("");
  };

  const handleSaveEdit = async () => {
    if (!editingElement || !editName.trim()) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`${backendUrl}/api/elements/${editingElement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim().replace(/\s+/g, ""),
          color: editColor,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setElements((prev) =>
          prev.map((el) => (el.id === editingElement.id ? data.element : el))
        );
        setEditingElement(null);
        setEditName("");
        setEditColor("");
      }
    } catch (error) {
      console.error("Failed to update element:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-['Geist',sans-serif]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap');
      `}</style>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-white/5 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="text-white/60 hover:text-white hover:bg-white/5"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Riley Studio" className="w-8 h-8 rounded-lg object-cover" />
              <span className="font-semibold text-lg tracking-tight">Riley Studio</span>
            </div>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
              setIsAddDialogOpen(open);
              if (!open) resetDialogState();
            }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-amber-400 to-orange-500 text-black font-semibold hover:from-amber-500 hover:to-orange-600">
                <Plus className="w-4 h-4 mr-2" />
                Add Element
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1a1a1c] border-white/10">
              <DialogHeader>
                <DialogTitle className="text-white">Add New Element</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-white/80">
                    Element Name
                  </Label>
                  <Input
                    id="name"
                    value={newElementName}
                    onChange={(e) => setNewElementName(e.target.value)}
                    placeholder="e.g., Riley, IntenseThumbnail"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                  <p className="text-xs text-white/40">
                    Use this name with @ to reference in prompts
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-white/80">Image Source</Label>
                  <Tabs value={inputMode} onValueChange={(v) => {
                    setInputMode(v as "upload" | "youtube");
                    setNewElementImage(null);
                    setYoutubeError(null);
                  }}>
                    <TabsList className="grid w-full grid-cols-2 bg-white/5">
                      <TabsTrigger
                        value="upload"
                        className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-400 data-[state=active]:to-orange-500 data-[state=active]:text-black"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                      </TabsTrigger>
                      <TabsTrigger
                        value="youtube"
                        className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white"
                      >
                        <Youtube className="w-4 h-4 mr-2" />
                        YouTube
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="upload" className="mt-4">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        className="hidden"
                      />

                      {newElementImage ? (
                        <div className="relative">
                          <img
                            src={newElementImage.preview}
                            alt="Preview"
                            className="w-full h-auto object-contain rounded-lg"
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            Change
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full h-48 border-2 border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center gap-3 hover:border-white/20 transition-colors"
                        >
                          <Upload className="w-8 h-8 text-white/40" />
                          <span className="text-white/40 text-sm">Click to upload image</span>
                        </button>
                      )}
                    </TabsContent>

                    <TabsContent value="youtube" className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <Input
                          value={youtubeUrl}
                          onChange={handleYoutubeUrlChange}
                          placeholder="Paste YouTube URL here..."
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                        />
                        <p className="text-xs text-white/40">
                          Paste a YouTube video URL - thumbnail will load automatically
                        </p>
                        {youtubeError && (
                          <p className="text-xs text-red-400">{youtubeError}</p>
                        )}
                      </div>

                      {isFetchingThumbnail ? (
                        <div className="w-full py-12 rounded-lg bg-white/5 flex items-center justify-center">
                          <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                            <span className="text-white/40 text-sm">Fetching thumbnail...</span>
                          </div>
                        </div>
                      ) : newElementImage ? (
                        <div className="relative">
                          <img
                            src={newElementImage.preview}
                            alt="YouTube Thumbnail"
                            className="w-full h-auto object-contain rounded-lg"
                          />
                          <div className="absolute top-2 left-2 px-2 py-1 bg-red-500 rounded text-xs text-white flex items-center gap-1">
                            <Youtube className="w-3 h-3" />
                            YouTube
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-48 border-2 border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center gap-3">
                          <Youtube className="w-8 h-8 text-white/20" />
                          <span className="text-white/30 text-sm">Thumbnail preview will appear here</span>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>

                <Button
                  onClick={handleAddElement}
                  disabled={!newElementName.trim() || !newElementImage || isSubmitting}
                  className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-black font-semibold hover:from-amber-500 hover:to-orange-600 disabled:opacity-50"
                >
                  {isSubmitting ? "Adding..." : "Add Element"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 px-6 pb-8">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square">
                <Skeleton className="w-full h-full rounded-xl bg-white/5" />
              </div>
            ))}
          </div>
        ) : elements.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center mb-6">
              <ImageIcon className="w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">No Elements Yet</h2>
            <p className="text-white/40 max-w-md mb-6">
              Elements are reusable assets you can reference in your prompts using @mentions.
            </p>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-gradient-to-r from-amber-400 to-orange-500 text-black font-semibold hover:from-amber-500 hover:to-orange-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Element
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              <AnimatePresence>
                {elements.map((element) => (
                  <motion.div
                    key={element.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group relative bg-white/5 rounded-xl overflow-hidden"
                  >
                    <img
                      src={`data:${element.mimeType};base64,${element.imageBase64}`}
                      alt={element.name}
                      className="w-full h-auto object-contain"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="font-medium" style={{ color: element.color }}>@{element.name}</p>
                      </div>
                      <div className="absolute top-3 right-3 flex gap-2">
                        <button
                          onClick={() => handleStartEdit(element)}
                          className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setElementToDelete(element)}
                          className="w-8 h-8 bg-red-500/80 hover:bg-red-500 rounded-lg flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent group-hover:opacity-0 transition-opacity">
                      <p className="text-sm font-medium truncate" style={{ color: element.color }}>@{element.name}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button
                  onClick={loadMore}
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
          </>
        )}
      </main>

      {/* Edit Element Dialog */}
      <Dialog open={!!editingElement} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent className="bg-[#1a1a1c] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Element</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingElement && (
              <div className="flex justify-center">
                <img
                  src={`data:${editingElement.mimeType};base64,${editingElement.imageBase64}`}
                  alt={editingElement.name}
                  className="max-h-40 rounded-lg object-contain"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-white/80">
                Element Name
              </Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Element name"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
              <p className="text-xs text-white/40">
                Use this name with @ to reference in prompts
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Element Color</Label>
              <div className="flex gap-2 flex-wrap">
                {ELEMENT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setEditColor(color)}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      editColor === color
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#1a1a1c] scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <p className="text-xs text-white/40">
                This color will be used when the element is mentioned
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                className="flex-1 border-white/10 text-white hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={!editName.trim() || isUpdating}
                className="flex-1 bg-gradient-to-r from-amber-400 to-orange-500 text-black font-semibold hover:from-amber-500 hover:to-orange-600 disabled:opacity-50"
              >
                {isUpdating ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!elementToDelete} onOpenChange={() => setElementToDelete(null)}>
        <AlertDialogContent className="bg-[#1a1a1c] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Element</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Are you sure you want to delete @{elementToDelete?.name}? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteElement}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Elements;

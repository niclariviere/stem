import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, ThumbsUp, ThumbsDown, Heart, Paperclip, Link2, X, Send, Trash2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { uploadToIPFS, attachmentKind } from "@/lib/mediaUpload";
import { toast } from "sonner";

type Attachment = { type: "image" | "audio" | "video" | "link"; url: string; name?: string };
type ReactionType = "up" | "down" | "heart";

function AttachmentView({ a }: { a: Attachment }) {
  if (a.type === "image") {
    return <img src={a.url} alt={a.name ?? "image"} className="rounded-lg max-h-96 w-auto border border-border/50" />;
  }
  if (a.type === "audio") {
    return <audio controls src={a.url} className="w-full" />;
  }
  if (a.type === "video") {
    return <video controls src={a.url} className="rounded-lg max-h-96 w-full border border-border/50" />;
  }
  return (
    <a href={a.url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-sm text-primary hover:underline break-all">
      <Link2 className="h-3.5 w-3.5 shrink-0" /> {a.name ?? a.url}
    </a>
  );
}

export default function Newsfeed() {
  const [, navigate] = useLocation();
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const fileInput = useRef<HTMLInputElement>(null);

  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: posts, refetch } = trpc.newsfeed.list.useQuery();
  const createPost = trpc.newsfeed.post.useMutation();
  const react = trpc.newsfeed.react.useMutation();
  const removePost = trpc.newsfeed.delete.useMutation();

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name} is over 50MB`);
          continue;
        }
        const { url } = await uploadToIPFS(file);
        setAttachments(prev => [...prev, { type: attachmentKind(file), url, name: file.name }]);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const addLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      toast.error("That doesn't look like a valid URL");
      return;
    }
    setAttachments(prev => [...prev, { type: "link", url }]);
    setLinkInput("");
    setShowLink(false);
  };

  const removeAttachment = (i: number) => setAttachments(prev => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!body.trim() && attachments.length === 0) {
      toast.error("Write something or attach a file");
      return;
    }
    try {
      await createPost.mutateAsync({ body: body.trim() || undefined, attachments });
      setBody("");
      setAttachments([]);
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to post");
    }
  };

  const toggleReaction = async (postId: number, type: ReactionType) => {
    await react.mutateAsync({ postId, type });
    refetch();
  };

  const handleDelete = async (postId: number) => {
    await removePost.mutateAsync({ postId });
    refetch();
  };

  const myReaction = (reactors: { userId: number; type: string }[]): string | undefined =>
    reactors.find(r => r.userId === user?.id)?.type;

  const REACTIONS: { type: ReactionType; icon: typeof ThumbsUp; activeClass: string }[] = [
    { type: "up", icon: ThumbsUp, activeClass: "text-accent" },
    { type: "down", icon: ThumbsDown, activeClass: "text-destructive" },
    { type: "heart", icon: Heart, activeClass: "text-primary" },
  ];

  return (
    <div className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="outline" size="icon" onClick={() => navigate("/profile")}
          className="border-border text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">Feed</h1>
      </div>

      {/* Composer */}
      <div className="surface-glass rounded-lg p-5 mb-8">
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Share an idea, an update, a date, a sound…"
          className="min-h-20 mb-3 bg-background/40 border-0 focus-visible:ring-1"
        />

        {attachments.length > 0 && (
          <div className="space-y-2 mb-3">
            {attachments.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-xs bg-background/40 rounded-md px-3 py-2">
                <span className="truncate text-muted-foreground">
                  <span className="uppercase tracking-wide text-foreground/60 mr-2">{a.type}</span>
                  {a.name ?? a.url}
                </span>
                <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {showLink && (
          <div className="flex gap-2 mb-3">
            <Input
              value={linkInput}
              onChange={e => setLinkInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addLink()}
              placeholder="https://…"
              className="bg-background/40 text-sm"
            />
            <Button variant="outline" size="sm" onClick={addLink}>Add</Button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <input
              ref={fileInput}
              type="file"
              accept="image/*,audio/*,video/*"
              multiple
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
            <Button variant="ghost" size="icon" onClick={() => fileInput.current?.click()} disabled={uploading}
              className="text-muted-foreground hover:text-foreground" title="Attach image / audio / video">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowLink(v => !v)}
              className="text-muted-foreground hover:text-foreground" title="Add a link">
              <Link2 className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={submit} disabled={createPost.isPending || uploading}
            className="gradient-primary text-primary-foreground">
            <Send className="h-3.5 w-3.5 mr-1.5" /> Post
          </Button>
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {!posts?.length ? (
            <p className="text-sm text-muted-foreground/50 text-center py-10">
              Nothing here yet — be the first to post.
            </p>
          ) : (
            posts.map((p: any) => {
              const mine = myReaction(p.reactors);
              const canDelete = p.authorId === user?.id || user?.role === "admin";
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="surface-glass rounded-lg p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-display font-medium text-foreground">{p.authorName}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {canDelete && (
                      <button onClick={() => handleDelete(p.id)} className="text-muted-foreground/50 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {p.body && <p className="text-sm text-foreground/90 whitespace-pre-wrap mb-3">{p.body}</p>}

                  {p.attachments?.length > 0 && (
                    <div className="space-y-3 mb-3">
                      {p.attachments.map((a: Attachment, i: number) => <AttachmentView key={i} a={a} />)}
                    </div>
                  )}

                  <div className="flex items-center gap-1 pt-2 border-t border-border/40">
                    {REACTIONS.map(({ type, icon: Icon, activeClass }) => (
                      <button
                        key={type}
                        onClick={() => toggleReaction(p.id, type)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors hover:bg-secondary/50 ${
                          mine === type ? activeClass : "text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{p.reactions[type]}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const NONE = "__none__";
const CREATE = "__create__";

/**
 * Owner controls on a stem card (library + profile): "Show on profile" switch,
 * a single-collection dropdown (none / existing / create new), and a delete
 * action gated behind a double-confirm (checkbox + button).
 */
export function StemManageControls({ stem }: { stem: any }) {
  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.stems.list.invalidate();
    utils.profile.get.invalidate();
    utils.collections.list.invalidate();
  };

  const { data: collections } = trpc.collections.list.useQuery();

  const [show, setShow] = useState<boolean>(stem.showOnProfile !== false);
  const [collectionId, setCollectionId] = useState<number | null>(stem.collectionId ?? null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const setShowMut = trpc.stems.setShowOnProfile.useMutation({ onSuccess: invalidate });
  const setColMut = trpc.collections.setStemCollection.useMutation({
    onSuccess: invalidate,
    onError: e => toast.error(e.message ?? "Couldn't update collection"),
  });
  const createColMut = trpc.collections.create.useMutation();
  const delMut = trpc.stems.delete.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Stem deleted");
    },
    onError: e => toast.error(e.message ?? "Delete failed"),
  });

  const toggleShow = (next: boolean) => {
    setShow(next);
    setShowMut.mutate({ stemId: stem.id, show: next }, { onError: () => setShow(!next) });
  };

  const onSelect = (value: string) => {
    if (value === CREATE) {
      setCreating(true);
      return;
    }
    setCreating(false);
    const next = value === NONE ? null : Number(value);
    setCollectionId(next);
    setColMut.mutate({ stemId: stem.id, collectionId: next });
  };

  const confirmCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const res = await createColMut.mutateAsync({ name });
      if (res.id) {
        setCollectionId(res.id);
        setColMut.mutate({ stemId: stem.id, collectionId: res.id });
      }
      setNewName("");
      setCreating(false);
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't create collection");
    }
  };

  const confirmDelete = () => {
    if (!confirmChecked) return;
    delMut.mutate({ stemId: stem.id });
    setConfirmOpen(false);
    setConfirmChecked(false);
  };

  const selectValue = creating ? CREATE : collectionId != null ? String(collectionId) : NONE;

  return (
    <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <Switch checked={show} onCheckedChange={toggleShow} />
          Show on profile
        </label>
        <button
          onClick={() => setConfirmOpen(true)}
          className="text-muted-foreground/40 hover:text-destructive transition-colors"
          title="Delete stem"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <Select value={selectValue} onValueChange={onSelect}>
        <SelectTrigger className="h-8 text-xs bg-secondary/40 border-border w-full">
          <SelectValue placeholder="No collection" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No collection</SelectItem>
          {collections?.map(c => (
            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
          ))}
          <SelectItem value={CREATE}>+ Create new…</SelectItem>
        </SelectContent>
      </Select>

      {creating && (
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); confirmCreate(); }
              if (e.key === "Escape") { setCreating(false); setNewName(""); }
            }}
            placeholder="New collection name…"
            autoFocus
            className="h-8 text-xs bg-secondary/40"
          />
          <Button size="sm" className="h-8 text-xs" onClick={confirmCreate} disabled={createColMut.isPending || !newName.trim()}>
            Add
          </Button>
        </div>
      )}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={o => {
          setConfirmOpen(o);
          if (!o) setConfirmChecked(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this stem?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="text-foreground font-medium">{stem.fileName}</span> from the system.
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <label className="flex items-center gap-2 text-sm text-foreground/80 cursor-pointer py-2 select-none">
            <Checkbox
              checked={confirmChecked}
              onCheckedChange={c => setConfirmChecked(c === true)}
            />
            Yes, I&apos;m sure — permanently delete it.
          </label>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!confirmChecked || delMut.isPending}
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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

/**
 * Owner controls shown on a stem card (library + profile): a "Show on profile"
 * switch and a delete action gated behind a double-confirm (checkbox + button).
 * Invalidates both the library list and the profile after any change.
 */
export function StemManageControls({ stem }: { stem: any }) {
  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.stems.list.invalidate();
    utils.profile.get.invalidate();
  };

  const [show, setShow] = useState<boolean>(stem.showOnProfile !== false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const setShowMut = trpc.stems.setShowOnProfile.useMutation({ onSuccess: invalidate });
  const delMut = trpc.stems.delete.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Stem deleted");
    },
    onError: e => toast.error(e.message ?? "Delete failed"),
  });

  const toggleShow = (next: boolean) => {
    setShow(next); // optimistic
    setShowMut.mutate({ stemId: stem.id, show: next }, { onError: () => setShow(!next) });
  };

  const confirmDelete = () => {
    if (!confirmChecked) return;
    delMut.mutate({ stemId: stem.id });
    setConfirmOpen(false);
    setConfirmChecked(false);
  };

  return (
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
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

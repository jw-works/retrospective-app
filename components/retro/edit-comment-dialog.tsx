import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type EditCommentDialogProps = {
  open: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

export function EditCommentDialog({ open, value, onValueChange, onClose, onSave }: EditCommentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Comment</DialogTitle>
          <DialogDescription>Update your comment text.</DialogDescription>
        </DialogHeader>
        <Textarea
          className="mt-4 min-h-[110px] w-full rounded-[10px] border border-retro-border-soft bg-retro-card px-3 py-2 text-retro-strong placeholder:text-retro-subtle"
          placeholder="Update your comment"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              onSave();
            }
          }}
          autoFocus
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

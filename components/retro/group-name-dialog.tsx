import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type GroupNameDialogProps = {
  open: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onClose: () => void;
  onCreate: () => void;
};

export function GroupNameDialog({ open, value, onValueChange, onClose, onCreate }: GroupNameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Name New Group</DialogTitle>
          <DialogDescription>Choose a name for the merged card.</DialogDescription>
        </DialogHeader>
        <Input
          className="mt-4 block h-[42px] w-full rounded-[10px] border border-retro-border-soft bg-retro-card px-3 text-retro-strong placeholder:text-retro-subtle"
          placeholder="Group name"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onCreate();
            }
          }}
          autoFocus
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onCreate}>
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

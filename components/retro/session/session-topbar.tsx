import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type SessionTopBarProps = {
  teamName: string;
  sessionId: string;
  sprintDisplayLabel: string;
  showSprintLabel: boolean;
  inviteCopied: boolean;
  apiError: string | null;
  discussionMode: boolean;
  isAdmin: boolean;
  hasDiscussionItems: boolean;
  everyoneDoneVoting: boolean;
  onCopyInviteLink: () => void;
  onStartDiscussion: () => void;
  onBackToBoard: () => void;
  onEndSession: () => void;
};

export function SessionTopBar({
  teamName,
  sessionId,
  sprintDisplayLabel,
  showSprintLabel,
  inviteCopied,
  apiError,
  discussionMode,
  isAdmin,
  hasDiscussionItems,
  everyoneDoneVoting,
  onCopyInviteLink,
  onStartDiscussion,
  onBackToBoard,
  onEndSession,
}: SessionTopBarProps) {
  return (
    <section className="my-[14px] mb-[26px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-[34px] leading-[1.15] font-medium text-retro-heading">{teamName.trim()} Retrospective</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-retro-muted">
            {showSprintLabel ? (
              <span className="rounded-[10px] border border-retro-border bg-retro-surface-soft px-2.5 py-1">{sprintDisplayLabel}</span>
            ) : null}
            <span className="rounded-[10px] border border-retro-border bg-retro-surface-soft px-2.5 py-1">{sessionId}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto rounded-[10px] px-2.5 py-1 text-xs text-retro-body"
              onClick={onCopyInviteLink}
            >
              <Share2 className="size-3.5" />
              {inviteCopied ? "Copied" : "Copy invite link"}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!discussionMode ? (
            <Button type="button" onClick={onStartDiscussion} disabled={!hasDiscussionItems || !isAdmin}>
              {everyoneDoneVoting ? "Start Discussion" : "Start Discussion Anyway"}
            </Button>
          ) : (
            <Button type="button" variant="outline" disabled={!isAdmin} onClick={onBackToBoard}>
              Back To Board
            </Button>
          )}
          {isAdmin ? (
            <Button type="button" variant="outline" onClick={onEndSession}>
              End Session
            </Button>
          ) : null}
        </div>
      </div>
      {apiError ? <p className="mt-2 text-sm text-retro-danger">{apiError}</p> : null}
    </section>
  );
}

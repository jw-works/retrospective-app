import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SetupScreenProps = {
  inviteSlugFromUrl: string;
  teamName: string;
  adminName: string;
  sprintLabel: string;
  voteLimit: string;
  joinSessionCode: string;
  joinParticipantName: string;
  canEnterRetro: boolean;
  canJoinSession: boolean;
  apiError: string | null;
  joinError: string | null;
  onTeamNameChange: (value: string) => void;
  onAdminNameChange: (value: string) => void;
  onSprintLabelChange: (value: string) => void;
  onVoteLimitChange: (value: string) => void;
  onJoinSessionCodeChange: (value: string) => void;
  onJoinParticipantNameChange: (value: string) => void;
  onCreateSession: () => void;
  onJoinSession: () => void;
  onClearJoinError: () => void;
};

export function SetupScreen({
  inviteSlugFromUrl,
  teamName,
  adminName,
  sprintLabel,
  voteLimit,
  joinSessionCode,
  joinParticipantName,
  canEnterRetro,
  canJoinSession,
  apiError,
  joinError,
  onTeamNameChange,
  onAdminNameChange,
  onSprintLabelChange,
  onVoteLimitChange,
  onJoinSessionCodeChange,
  onJoinParticipantNameChange,
  onCreateSession,
  onJoinSession,
  onClearJoinError,
}: SetupScreenProps) {
  if (inviteSlugFromUrl) {
    return (
      <section className="my-[14px] mb-[26px]">
        <div className="mx-auto max-w-[540px] overflow-hidden rounded-[20px] border border-retro-border-soft bg-retro-surface p-7 shadow-[0_24px_46px_rgba(0,0,0,0.06)]">
          <p className="text-xs tracking-[0.2em] text-retro-muted uppercase">Join Session</p>
          <h1 className="mt-2 text-[34px] leading-[1.1] font-medium text-retro-heading">Enter Your Name</h1>
          <p className="mt-2 text-sm text-retro-muted">
            You are joining session <span className="font-medium text-retro-strong">{inviteSlugFromUrl}</span>.
          </p>
          <div className="mt-6">
            <Input
              className="block h-[44px] w-full rounded-[12px] border border-retro-border-soft bg-retro-card-strong px-3 text-retro-strong placeholder:text-retro-subtle"
              placeholder="Your name"
              value={joinParticipantName}
              onChange={(event) => {
                onClearJoinError();
                onJoinParticipantNameChange(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onJoinSession();
                }
              }}
            />
          </div>
          <div className="mt-6">
            <Button type="button" onClick={onJoinSession} disabled={!canJoinSession}>
              Join Session
            </Button>
          </div>
          {joinError ? <p className="mt-3 text-sm text-retro-danger">{joinError}</p> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="my-[14px] mb-[26px]">
      <div className="relative overflow-hidden rounded-[20px] border border-retro-border-soft bg-retro-surface p-7 shadow-[0_24px_46px_rgba(0,0,0,0.06)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_10%_15%,rgba(255,255,255,0.32),rgba(255,255,255,0)_46%),radial-gradient(circle_at_90%_90%,rgba(255,255,255,0.24),rgba(255,255,255,0)_45%)] before:content-[''] dark:before:bg-none">
        <div className="relative z-10 grid grid-cols-[1.45fr_1fr] gap-6 max-[840px]:grid-cols-1">
          <section>
            <p className="text-xs tracking-[0.2em] text-retro-muted uppercase">Welcome</p>
            <h1 className="mt-2 text-[38px] leading-[1.05] font-medium text-retro-heading">Create a New Retro Room</h1>
            <p className="mt-3 max-w-[45ch] text-sm text-retro-muted">
              Give your session a team identity and assign the facilitator before the board unlocks.
            </p>

            <div className="mt-6 grid gap-3">
              <div>
                <Label htmlFor="team-name" className="mb-1 block text-sm text-retro-strong">
                  Team Name
                </Label>
                <Input
                  id="team-name"
                  className="block h-[44px] w-full rounded-[12px] border border-retro-border-soft bg-retro-card-strong px-3 text-retro-strong placeholder:text-retro-subtle"
                  placeholder="e.g. Product Engineering"
                  value={teamName}
                  onChange={(event) => onTeamNameChange(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="admin-name" className="mb-1 block text-sm text-retro-strong">
                  Facilitator Name
                </Label>
                <Input
                  id="admin-name"
                  className="block h-[44px] w-full rounded-[12px] border border-retro-border-soft bg-retro-card-strong px-3 text-retro-strong placeholder:text-retro-subtle"
                  placeholder="e.g. Alex Johnson"
                  value={adminName}
                  onChange={(event) => onAdminNameChange(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
                <div>
                  <Label htmlFor="sprint-label" className="mb-1 block text-sm text-retro-strong">
                    Sprint Number (optional)
                  </Label>
                  <Input
                    id="sprint-label"
                    className="block h-[44px] w-full rounded-[12px] border border-retro-border-soft bg-retro-card-strong px-3 text-retro-strong placeholder:text-retro-subtle"
                    placeholder="e.g. 24"
                    value={sprintLabel}
                    onChange={(event) => onSprintLabelChange(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="vote-limit" className="mb-1 block text-sm text-retro-strong">
                    Votes Per Person
                  </Label>
                  <Input
                    id="vote-limit"
                    type="number"
                    min={1}
                    max={20}
                    className="block h-[44px] w-full rounded-[12px] border border-retro-border-soft bg-retro-card-strong px-3 text-retro-strong placeholder:text-retro-subtle"
                    placeholder="e.g. 5"
                    value={voteLimit}
                    onChange={(event) => onVoteLimitChange(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Button type="button" onClick={onCreateSession} disabled={!canEnterRetro}>
                Launch Retrospective
              </Button>
            </div>
            {apiError ? <p className="mt-3 text-sm text-retro-danger">{apiError}</p> : null}
          </section>

          <section className="rounded-[16px] border border-retro-border-soft bg-retro-surface-soft p-5">
            <h3 className="m-0 text-base font-medium text-retro-strong">Join Instead</h3>
            <p className="mt-2 text-xs text-retro-muted">Got a shared session code? Join an existing retrospective room.</p>
            <div className="mt-4 grid gap-2.5 rounded-[14px] border border-retro-border-soft bg-retro-card p-4">
              <Input
                className="block h-[40px] w-full rounded-[10px] border border-retro-border-soft bg-retro-card-hover px-3 text-sm text-retro-strong placeholder:text-retro-subtle"
                placeholder="Session code or invite URL"
                value={joinSessionCode}
                onChange={(event) => {
                  onClearJoinError();
                  onJoinSessionCodeChange(event.target.value);
                }}
              />
              <Input
                className="block h-[40px] w-full rounded-[10px] border border-retro-border-soft bg-retro-card-hover px-3 text-sm text-retro-strong placeholder:text-retro-subtle"
                placeholder="Your name"
                value={joinParticipantName}
                onChange={(event) => {
                  onClearJoinError();
                  onJoinParticipantNameChange(event.target.value);
                }}
              />
              <Button type="button" variant="outline" disabled={!canJoinSession} onClick={onJoinSession}>
                Join Session
              </Button>
            </div>
            <div className="mt-4 rounded-[12px] border border-retro-border-soft bg-retro-surface-soft px-3 py-2 text-xs text-retro-muted">
              Ask the admin to share the invite code from their session.
            </div>
            {joinError ? <p className="mt-3 text-sm text-retro-danger">{joinError}</p> : null}
          </section>
        </div>
      </div>
    </section>
  );
}

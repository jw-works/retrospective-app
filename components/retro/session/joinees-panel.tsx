import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { colorToneIndexFromSeed, initialsFromName } from "@/lib/retro/utils";

type ParticipantSummary = {
  id: string;
  name: string;
  isAdmin: boolean;
  votesRemaining: number;
};

type JoineesPanelProps = {
  participants: ParticipantSummary[];
  joineesDoneVoting: number;
  totalParticipants: number;
};

export function JoineesPanel({ participants, joineesDoneVoting, totalParticipants }: JoineesPanelProps) {
  const shortParticipantId = (id: string) => id.split("-")[0] ?? id.slice(0, 8);

  return (
    <aside className="flex flex-col gap-4">
      <section className="relative overflow-hidden rounded-2xl border border-retro-border-soft bg-retro-surface p-[18px] shadow-[0_18px_38px_rgba(0,0,0,0.05)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/40 before:to-white/0 before:content-[''] dark:before:bg-none">
        <div className="relative z-10">
          <h3 className="m-0 text-base font-medium text-retro-strong">Joinees List</h3>
          <div className="mt-2 rounded-[12px] border border-retro-border-soft bg-retro-card px-3 py-2">
            <p className="text-xs text-retro-muted">Voting progress: {joineesDoneVoting}/{totalParticipants} done</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-retro-surface-soft">
              <div
                className="h-full rounded-full bg-[var(--retro-action)] transition-all"
                style={{ width: totalParticipants > 0 ? `${(joineesDoneVoting / totalParticipants) * 100}%` : "0%" }}
              />
            </div>
          </div>
          <ul aria-label="Joinees list" className="mt-3 flex list-none flex-col gap-2.5 p-0">
            {participants.map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-retro-border-soft bg-retro-card px-3 py-3">
                <span className="inline-flex min-w-0 items-center gap-2.5 text-sm text-retro-body">
                  <Avatar aria-hidden className={`identity-badge identity-tone-${colorToneIndexFromSeed(person.id)} size-[24px] border`}>
                    <AvatarFallback className="bg-transparent text-[10px] font-semibold text-inherit">
                      {initialsFromName(person.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0">
                    <span className="block truncate">{person.name}</span>
                    <span className="block text-[11px] text-retro-subtle">ID {shortParticipantId(person.id)}</span>
                  </span>
                </span>
                {person.isAdmin ? <span className="text-xs text-retro-muted">admin</span> : <span className="text-xs text-retro-muted">{person.votesRemaining} left</span>}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </aside>
  );
}

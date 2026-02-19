import { Moon, Sun } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type AppShellHeaderProps = {
  isSetupComplete: boolean;
  stageOrder: readonly string[];
  stageLabel: Record<string, string>;
  currentStageIndex: number;
  theme: "light" | "dark";
  themeReady: boolean;
  onToggleTheme: () => void;
  currentUserTone: number;
  currentUserInitials: string;
};

export function AppShellHeader({
  isSetupComplete,
  stageOrder,
  stageLabel,
  currentStageIndex,
  theme,
  themeReady,
  onToggleTheme,
  currentUserTone,
  currentUserInitials,
}: AppShellHeaderProps) {
  return (
    <header className="mb-7 flex items-center justify-between text-sm text-retro-muted">
      {isSetupComplete ? (
        <div className="flex items-center gap-2">
          {stageOrder.map((stage, index) => {
            const isCurrent = index === currentStageIndex;
            const isDone = index < currentStageIndex;
            return (
              <div key={stage} className="flex items-center gap-2">
                <Badge
                  className={`inline-flex items-center rounded-full border px-3 py-2 text-xs ${
                    isCurrent
                      ? "border-retro-border bg-retro-card-hover text-retro-body"
                      : isDone
                        ? "border-retro-border bg-retro-surface-soft text-retro-body"
                        : "border-retro-border-soft bg-retro-card text-retro-subtle"
                  }`}
                >
                  {stageLabel[stage]}
                </Badge>
                {index < stageOrder.length - 1 ? <span className="text-retro-subtle">›</span> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Badge className="inline-flex items-center gap-2 rounded-full border border-retro-border bg-retro-surface-soft px-3 py-2 text-xs text-retro-strong before:size-1.5 before:rounded-full before:bg-retro-dot before:content-['']">
            Session Launchpad
          </Badge>
          <span className="text-xs text-retro-subtle">Create your retrospective room</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Toggle dark mode"
          className="grid size-[34px] place-items-center rounded-full border border-retro-border bg-retro-surface-soft text-retro-strong"
          onClick={onToggleTheme}
        >
          {!themeReady ? <Moon className="size-4" /> : theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <Avatar className={`identity-badge identity-tone-${currentUserTone} size-[34px] border shadow-[0_10px_22px_rgba(0,0,0,0.07)]`}>
          <AvatarFallback className="bg-transparent text-[11px] font-medium text-inherit">
            {currentUserInitials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

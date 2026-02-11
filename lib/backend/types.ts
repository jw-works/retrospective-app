// Shared domain types used by:
// - backend store and API routes (source of truth),
// - frontend API client typing,
// - UI state transformations.
export type SessionPhase = "collecting" | "discussing" | "finished";

export type Section = "retro" | "discussion" | "actions" | "happiness" | "done";

export type EntryType = "went_right" | "went_wrong";

export type Participant = {
  id: string;
  sessionId: string;
  name: string;
  isAdmin: boolean;
  createdAt: string;
};

export type Session = {
  id: string;
  slug: string;
  title: string;
  sprintLabel?: string | null;
  createdByParticipantId: string;
  phase: SessionPhase;
  createdAt: string;
  updatedAt: string;
};

export type Entry = {
  id: string;
  sessionId: string;
  authorParticipantId: string;
  type: EntryType;
  content: string;
  groupId: string | null;
  createdAt: string;
};

export type EntryGroup = {
  id: string;
  sessionId: string;
  type: EntryType;
  name: string;
  createdAt: string;
};

export type Vote = {
  id: string;
  sessionId: string;
  entryId: string;
  participantId: string;
  value: 1;
  createdAt: string;
};

export type HappinessCheck = {
  id: string;
  sessionId: string;
  participantId: string;
  score: number;
  createdAt: string;
  updatedAt: string;
};

export type NavigationState = {
  sessionId: string;
  activeSection: Section;
  discussionEntryId: string | null;
  updatedAt: string;
};

export type ActionItem = {
  id: string;
  sessionId: string;
  createdByParticipantId: string;
  content: string;
  createdAt: string;
};

export type AuthToken = {
  token: string;
  participantId: string;
  sessionId: string;
  createdAt: string;
};

export type StoreData = {
  sessions: Session[];
  participants: Participant[];
  entries: Entry[];
  groups: EntryGroup[];
  actionItems: ActionItem[];
  votes: Vote[];
  happinessChecks: HappinessCheck[];
  navigation: NavigationState[];
  authTokens: AuthToken[];
};

export type PublicParticipant = Pick<Participant, "id" | "name" | "isAdmin" | "createdAt"> & {
  votesUsed: number;
  votesRemaining: number;
};

export type SessionViewer = {
  id: string;
  name: string;
  isAdmin: boolean;
  votesUsed: number;
  votesRemaining: number;
};

export type SessionStateResponse = {
  session: Pick<Session, "id" | "slug" | "title" | "sprintLabel" | "phase" | "createdAt" | "updatedAt">;
  participants: PublicParticipant[];
  entries: (Entry & { votes: number; votedByViewer: boolean })[];
  groups: EntryGroup[];
  actionItems: ActionItem[];
  navigation: NavigationState;
  viewer: SessionViewer | null;
  happiness: {
    average: number | null;
    count: number;
    viewerSubmitted: boolean;
  };
};

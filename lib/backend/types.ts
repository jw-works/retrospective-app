export type SessionPhase = "collecting" | "discussing" | "finished";

export type Section = "retro" | "discussion" | "happiness" | "done";

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
  votes: Vote[];
  happinessChecks: HappinessCheck[];
  navigation: NavigationState[];
  authTokens: AuthToken[];
};

export type PublicParticipant = Pick<Participant, "id" | "name" | "isAdmin" | "createdAt">;

export type SessionViewer = {
  id: string;
  name: string;
  isAdmin: boolean;
  votesUsed: number;
  votesRemaining: number;
};

export type SessionStateResponse = {
  session: Pick<Session, "id" | "slug" | "title" | "phase" | "createdAt" | "updatedAt">;
  participants: PublicParticipant[];
  entries: (Entry & { votes: number; votedByViewer: boolean })[];
  navigation: NavigationState;
  viewer: SessionViewer | null;
  happiness: {
    average: number | null;
    count: number;
  };
};

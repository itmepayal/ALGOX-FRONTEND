import { problemClient } from "./problemApi";

export type RevisionTopProblem = {
  problemId: string;
  title: string;
  slug?: string;
  difficulty?: string;
  category?: string;
  revisionCount: number;
};

export type RevisionSummary = {
  totalRevisions: number;
  usersWithRevision: number;
  topProblems: RevisionTopProblem[];
};

export type WeakTopicRow = {
  topic: string;
  attempted: number;
  solved: number;
  solveRate: number;
  revisionHints: number;
};

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data: T;
};

export const adminLearningApi = {
  sheetProgress: async () => {
    const res = await problemClient.get("/admin/learning/sheet-progress");
    return res.data;
  },
  topicEngagement: async () => {
    const res = await problemClient.get("/admin/learning/topic-engagement");
    return res.data;
  },
  weakTopics: async () => {
    const res = await problemClient.get<ApiEnvelope<WeakTopicRow[]>>(
      "/admin/learning/weak-topics"
    );
    return res.data;
  },
  revisionSummary: async (params?: { limit?: number }) => {
    const res = await problemClient.get<ApiEnvelope<RevisionSummary>>(
      "/admin/learning/revision-summary",
      {
        params,
      }
    );
    return res.data;
  },
};

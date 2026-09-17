import { PROBLEM_API_URL } from "./problemApi";
import type { Problem } from "./problemApi";
import { createServiceClient } from "./authClient";

export type UserReaction = "like" | "dislike" | null;

export interface EngagementState {
  likeCount: number;
  dislikeCount: number;
  bookmarkCount?: number;
  favouriteCount?: number;
  currentUserReaction: UserReaction;
  isBookmarked: boolean;
  isFavourite?: boolean;
  isRevision?: boolean;
}

/** Bookmark / favourite mutations must never be used to update revision UI state. */
export interface BookmarkMutationResult {
  isBookmarked: boolean;
  isFavourite?: boolean;
  bookmarkCount: number;
  favouriteCount?: number;
  likeCount: number;
  dislikeCount: number;
  currentUserReaction: UserReaction;
}

/** Revision mutations must never be used to update bookmark UI state. */
export interface RevisionMutationResult {
  isRevision: boolean;
}

export type FavouriteSolvedFilter = "all" | "solved" | "attempted" | "unsolved";
export type FavouriteAccessFilter = "all" | "free" | "premium";
export type FavouriteSort =
  | "recent"
  | "oldest"
  | "title_asc"
  | "title_desc"
  | "difficulty";

export interface FavouriteListQuery {
  page?: number;
  limit?: number;
  search?: string;
  difficulty?: string;
  category?: string;
  solved?: FavouriteSolvedFilter;
  accessType?: FavouriteAccessFilter;
  sort?: FavouriteSort;
  /** Force paged envelope even with defaults. */
  paginated?: boolean;
}

export interface FavouriteProblem extends Problem {
  isFavourite?: boolean;
  isPremium?: boolean;
  favouritedAt?: string | null;
  progressStatus?: "NOT_STARTED" | "ATTEMPTED" | "SOLVED";
  solvedStatus?: "solved" | "attempted" | "unsolved";
}

export interface FavouriteStats {
  total: number;
  solved: number;
  unsolved: number;
  attempted: number;
  easy: number;
  medium: number;
  hard: number;
}

export interface FavouriteListResult {
  items: FavouriteProblem[];
  stats: FavouriteStats;
  filters: { categories: string[] };
}

export interface FavouriteAnalytics {
  mostFavourited: Array<{
    id: string;
    title: string;
    slug: string;
    difficulty: string;
    category: string;
    favouriteCount: number;
    isPremium: boolean;
  }>;
  trends: Array<{ date: string; count: number }>;
  freeFavourites: number;
  premiumFavourites: number;
  mostFavouritedFree: FavouriteAnalytics["mostFavourited"];
  mostFavouritedPremium: FavouriteAnalytics["mostFavourited"];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const engagementClient = createServiceClient(PROBLEM_API_URL);

export const engagementApi = {
  getEngagement: async (problemId: string) => {
    const res = await engagementClient.get<ApiResponse<EngagementState>>(
      `/problems/${problemId}/engagement`
    );
    return res.data;
  },

  setReaction: async (problemId: string, reaction: "like" | "dislike") => {
    const res = await engagementClient.post<ApiResponse<EngagementState>>(
      `/problems/${problemId}/reaction`,
      { reaction }
    );
    return res.data;
  },

  clearReaction: async (problemId: string) => {
    const res = await engagementClient.delete<ApiResponse<EngagementState>>(
      `/problems/${problemId}/reaction`
    );
    return res.data;
  },

  addBookmark: async (problemId: string) => {
    const res = await engagementClient.post<ApiResponse<BookmarkMutationResult>>(
      `/problems/${problemId}/bookmark`
    );
    return res.data;
  },

  removeBookmark: async (problemId: string) => {
    const res = await engagementClient.delete<ApiResponse<BookmarkMutationResult>>(
      `/problems/${problemId}/bookmark`
    );
    return res.data;
  },

  toggleBookmark: async (problemId: string) => {
    const res = await engagementClient.post<ApiResponse<BookmarkMutationResult>>(
      `/problems/${problemId}/bookmark/toggle`
    );
    return res.data;
  },

  /** Flat list — backward compatible with Dashboard sheet sync. */
  listMyBookmarks: async () => {
    const res = await engagementClient.get<ApiResponse<Problem[]>>(
      `/problems/bookmarks/me`
    );
    return res.data;
  },

  /** Paginated favourites with stats + filters (server-side). */
  listMyFavourites: async (query?: FavouriteListQuery) => {
    const res = await engagementClient.get<ApiResponse<FavouriteListResult>>(
      `/problems/favourites/me`,
      {
        params: {
          paginated: true,
          page: query?.page ?? 1,
          limit: query?.limit ?? 20,
          search: query?.search || undefined,
          difficulty:
            query?.difficulty && query.difficulty !== "all"
              ? query.difficulty
              : undefined,
          category:
            query?.category && query.category !== "all"
              ? query.category
              : undefined,
          solved:
            query?.solved && query.solved !== "all" ? query.solved : undefined,
          accessType:
            query?.accessType && query.accessType !== "all"
              ? query.accessType
              : undefined,
          sort: query?.sort || "recent",
        },
      }
    );
    return res.data;
  },

  toggleRevision: async (problemId: string) => {
    const res = await engagementClient.post<ApiResponse<RevisionMutationResult>>(
      `/problems/${problemId}/revision/toggle`
    );
    return res.data;
  },

  addRevision: async (problemId: string) => {
    const res = await engagementClient.post<ApiResponse<RevisionMutationResult>>(
      `/problems/${problemId}/revision`
    );
    return res.data;
  },

  removeRevision: async (problemId: string) => {
    const res = await engagementClient.delete<
      ApiResponse<RevisionMutationResult>
    >(`/problems/${problemId}/revision`);
    return res.data;
  },

  listMyRevisions: async () => {
    const res = await engagementClient.get<
      ApiResponse<{ problemIds: string[] }>
    >(`/problems/revisions/me`);
    return res.data;
  },
};

/** Format counts like 2400 → 2.4K */
export function formatEngagementCount(n: number): string {
  if (!n || n < 0) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const v = n / 1000;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}K`;
  }
  const v = n / 1_000_000;
  return `${v.toFixed(1).replace(/\.0$/, "")}M`;
}

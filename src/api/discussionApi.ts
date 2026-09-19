import { discussionClient } from "./adminDiscussionApi";

export type DiscussionCategory =
  | "interview_experience"
  | "compensation"
  | "solution"
  | "general"
  | "career";

export type DiscussionSortBy = "latest" | "most_upvoted" | "hot";

export interface DiscussionPost {
  _id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  category?: DiscussionCategory | string;
  status?: string;
  isPinned?: boolean;
  isLocked?: boolean;
  upvotes: number;
  downvotes?: number;
  commentCount: number;
  viewsCount?: number;
  createdAt: string;
  updatedAt?: string;
  tags?: string[];
  companyTags?: string[];
  /** Present when API includes vote arrays or computed field */
  userVote?: "upvote" | "downvote" | null;
  isBookmarked?: boolean;
  upvotedBy?: string[];
  downvotedBy?: string[];
  bookmarkedBy?: string[];
}

export interface DiscussionComment {
  _id: string;
  postId: string;
  content: string;
  authorId: string;
  authorName: string;
  parentId?: string | null;
  upvotes?: number;
  createdAt: string;
}

/** Derive vote/bookmark UI state from raw post payload + current user. */
export function normalizeDiscussionPost(
  post: DiscussionPost,
  userId?: string
): DiscussionPost {
  if (!userId) {
    return {
      ...post,
      userVote: post.userVote ?? null,
      isBookmarked: Boolean(post.isBookmarked),
    };
  }
  const uid = String(userId);
  const up = (post.upvotedBy || []).map(String);
  const down = (post.downvotedBy || []).map(String);
  const bookmarks = (post.bookmarkedBy || []).map(String);
  let userVote = post.userVote ?? null;
  if (userVote == null) {
    if (up.includes(uid)) userVote = "upvote";
    else if (down.includes(uid)) userVote = "downvote";
  }
  const isBookmarked =
    post.isBookmarked != null
      ? Boolean(post.isBookmarked)
      : bookmarks.includes(uid);
  return { ...post, userVote, isBookmarked };
}

export const discussionApi = {
  listPosts: async (params?: Record<string, string | number | undefined>) => {
    const res = await discussionClient.get("/discussions/posts", { params });
    return res.data as {
      success: boolean;
      data: {
        posts: DiscussionPost[];
        total: number;
        page: number;
        limit?: number;
        totalPages: number;
        hasNextPage?: boolean;
        hasPreviousPage?: boolean;
      };
    };
  },

  getPost: async (id: string) => {
    const res = await discussionClient.get(`/discussions/posts/${id}`);
    return res.data as { success: boolean; data: DiscussionPost };
  },

  getComments: async (postId: string) => {
    const res = await discussionClient.get(
      `/discussions/posts/${postId}/comments`
    );
    return res.data as { success: boolean; data: DiscussionComment[] };
  },

  createPost: async (payload: {
    title: string;
    content: string;
    category?: DiscussionCategory;
    tags?: string[];
    authorName?: string;
  }) => {
    const res = await discussionClient.post("/discussions/posts", payload);
    return res.data as {
      success: boolean;
      data: DiscussionPost;
      message?: string;
    };
  },

  updatePost: async (
    id: string,
    payload: { title?: string; content?: string; tags?: string[] }
  ) => {
    const res = await discussionClient.patch(
      `/discussions/posts/${id}`,
      payload
    );
    return res.data as {
      success: boolean;
      data: DiscussionPost;
      message?: string;
    };
  },

  deletePost: async (id: string) => {
    const res = await discussionClient.delete(`/discussions/posts/${id}`);
    return res.data;
  },

  votePost: async (id: string, voteType: "upvote" | "downvote") => {
    const res = await discussionClient.post(`/discussions/posts/${id}/vote`, {
      voteType,
    });
    return res.data as {
      success: boolean;
      data: DiscussionPost;
      message?: string;
    };
  },

  bookmarkPost: async (id: string) => {
    const res = await discussionClient.post(
      `/discussions/posts/${id}/bookmark`
    );
    return res.data as {
      success: boolean;
      data: DiscussionPost;
      message?: string;
    };
  },

  addComment: async (payload: {
    postId: string;
    content: string;
    parentId?: string;
  }) => {
    const res = await discussionClient.post("/discussions/comments", payload);
    return res.data as {
      success: boolean;
      data: DiscussionComment;
      message?: string;
    };
  },

  updateComment: async (id: string, payload: { content: string }) => {
    const res = await discussionClient.patch(
      `/discussions/comments/${id}`,
      payload
    );
    return res.data as {
      success: boolean;
      data: DiscussionComment;
      message?: string;
    };
  },

  deleteComment: async (id: string) => {
    const res = await discussionClient.delete(`/discussions/comments/${id}`);
    return res.data;
  },

  reportPost: async (payload: {
    targetType: "DISCUSSION" | "COMMENT" | "USER" | "PROBLEM" | "SUBMISSION";
    targetId: string;
    reason:
      | "SPAM"
      | "ABUSE"
      | "HARASSMENT"
      | "INCORRECT_CONTENT"
      | "BUG"
      | "COPYRIGHT"
      | "CHEATING"
      | "OTHER";
    description?: string;
  }) => {
    const res = await discussionClient.post("/discussions/reports", payload);
    return res.data as { success: boolean; message?: string };
  },
};

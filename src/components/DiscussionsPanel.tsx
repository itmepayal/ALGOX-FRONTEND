import { useCallback, useEffect, useState, type FC } from "react";
import {
  ArrowLeft,
  Bookmark,
  Flag,
  Loader2,
  MessageSquare,
  Pencil,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import {
  discussionApi,
  type DiscussionComment,
  type DiscussionPost,
} from "../api/discussionApi";
import { useAuth } from "../context/AuthContext";

interface Props {
  authenticated?: boolean;
}

const REPORT_REASONS = [
  "SPAM",
  "ABUSE",
  "HARASSMENT",
  "INCORRECT_CONTENT",
  "OTHER",
] as const;

export const DiscussionsPanel: FC<Props> = ({ authenticated }) => {
  const { user } = useAuth();
  const userId = String(user?.id || user?._id || "");

  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<DiscussionPost | null>(null);
  const [comments, setComments] = useState<DiscussionComment[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [commentText, setCommentText] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingPost, setEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [reportReason, setReportReason] = useState<string>("SPAM");
  const [reporting, setReporting] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await discussionApi.listPosts({
        page: 1,
        limit: 50,
        sortBy: "recent",
      });
      setPosts(res.data?.posts || []);
    } catch {
      setError("Failed to load discussions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const openPost = async (post: DiscussionPost) => {
    setSelected(post);
    setEditingPost(false);
    setEditingCommentId(null);
    setLoadingDetail(true);
    try {
      const [postRes, commentsRes] = await Promise.all([
        discussionApi.getPost(post._id),
        discussionApi.getComments(post._id),
      ]);
      if (postRes.data) setSelected(postRes.data);
      setComments(commentsRes.data || []);
    } catch {
      setError("Failed to load post.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreate = async () => {
    if (!authenticated) {
      setError("Sign in to create a post.");
      return;
    }
    if (!title.trim() || !content.trim()) return;
    setCreating(true);
    setError("");
    try {
      await discussionApi.createPost({
        title: title.trim(),
        content: content.trim(),
      });
      setTitle("");
      setContent("");
      await loadPosts();
    } catch {
      setError("Failed to create post.");
    } finally {
      setCreating(false);
    }
  };

  const handleVote = async (postId: string, voteType: "upvote" | "downvote") => {
    if (!authenticated) {
      setError("Sign in to vote.");
      return;
    }
    try {
      const res = await discussionApi.votePost(postId, voteType);
      if (res.data) {
        setPosts((prev) =>
          prev.map((p) => (p._id === postId ? { ...p, ...res.data } : p))
        );
        if (selected?._id === postId)
          setSelected((p) => (p ? { ...p, ...res.data } : p));
      }
    } catch {
      setError("Failed to vote.");
    }
  };

  const handleBookmark = async (postId: string) => {
    if (!authenticated) {
      setError("Sign in to bookmark.");
      return;
    }
    try {
      const res = await discussionApi.bookmarkPost(postId);
      if (res.data) {
        setPosts((prev) =>
          prev.map((p) => (p._id === postId ? { ...p, ...res.data } : p))
        );
        if (selected?._id === postId)
          setSelected((p) => (p ? { ...p, ...res.data } : p));
      }
    } catch {
      setError("Failed to update bookmark.");
    }
  };

  const handleComment = async () => {
    if (!authenticated || !selected || !commentText.trim()) return;
    try {
      await discussionApi.addComment({
        postId: selected._id,
        content: commentText.trim(),
      });
      setCommentText("");
      const res = await discussionApi.getComments(selected._id);
      setComments(res.data || []);
    } catch {
      setError("Failed to add comment.");
    }
  };

  const handleUpdatePost = async () => {
    if (!selected || !editTitle.trim() || !editContent.trim()) return;
    try {
      const res = await discussionApi.updatePost(selected._id, {
        title: editTitle.trim(),
        content: editContent.trim(),
      });
      if (res.data) {
        setSelected(res.data);
        setPosts((prev) =>
          prev.map((p) => (p._id === selected._id ? { ...p, ...res.data } : p))
        );
      }
      setEditingPost(false);
    } catch {
      setError("Failed to update post.");
    }
  };

  const handleDeletePost = async () => {
    if (!selected || !window.confirm("Delete this post?")) return;
    try {
      await discussionApi.deletePost(selected._id);
      setSelected(null);
      await loadPosts();
    } catch {
      setError("Failed to delete post.");
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editCommentText.trim()) return;
    try {
      await discussionApi.updateComment(commentId, {
        content: editCommentText.trim(),
      });
      setEditingCommentId(null);
      if (selected) {
        const res = await discussionApi.getComments(selected._id);
        setComments(res.data || []);
      }
    } catch {
      setError("Failed to update comment.");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await discussionApi.deleteComment(commentId);
      if (selected) {
        const res = await discussionApi.getComments(selected._id);
        setComments(res.data || []);
      }
    } catch {
      setError("Failed to delete comment.");
    }
  };

  const handleReportPost = async () => {
    if (!authenticated || !selected) return;
    setReporting(true);
    setError("");
    try {
      await discussionApi.reportPost({
        targetType: "DISCUSSION",
        targetId: selected._id,
        reason: reportReason as (typeof REPORT_REASONS)[number],
      });
      setError("");
      alert("Report submitted. Thank you.");
    } catch {
      setError("Failed to submit report.");
    } finally {
      setReporting(false);
    }
  };

  const isOwnPost = selected && userId && selected.authorId === userId;

  if (selected) {
    return (
      <div className="learn-layout animate-fade-in">
        <header className="learn-header">
          <button
            type="button"
            className="platform-icon-btn"
            onClick={() => setSelected(null)}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>{selected.title}</h1>
            <p>
              by {selected.authorName} · {selected.upvotes} upvotes
              {selected.downvotes != null ? ` · ${selected.downvotes} downvotes` : ""}{" "}
              · {selected.commentCount} comments
            </p>
          </div>
        </header>

        {loadingDetail ? (
          <div className="loading-center">
            <Loader2 size={20} className="spin" /> Loading…
          </div>
        ) : (
          <div className="learn-grid-2">
            <section className="learn-card">
              {editingPost ? (
                <>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{
                      width: "100%",
                      marginBottom: 8,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-subtle)",
                      background: "var(--bg-input, var(--bg-card))",
                      color: "inherit",
                    }}
                  />
                  <textarea
                    className="lc-notes-area"
                    rows={6}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className="lc-hint-reveal-btn"
                      onClick={() => void handleUpdatePost()}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="lc-hint-reveal-btn"
                      onClick={() => setEditingPost(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {selected.content}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 16,
                      alignItems: "center",
                    }}
                  >
                    <button
                      type="button"
                      className="lc-hint-reveal-btn"
                      onClick={() => void handleVote(selected._id, "upvote")}
                    >
                      <ThumbsUp size={14} style={{ marginRight: 4 }} />
                      {selected.upvotes}
                    </button>
                    <button
                      type="button"
                      className="lc-hint-reveal-btn"
                      onClick={() => void handleVote(selected._id, "downvote")}
                    >
                      <ThumbsDown size={14} style={{ marginRight: 4 }} />
                      {selected.downvotes ?? 0}
                    </button>
                    {authenticated ? (
                      <button
                        type="button"
                        className="lc-hint-reveal-btn"
                        onClick={() => void handleBookmark(selected._id)}
                        aria-pressed={Boolean(selected.isBookmarked)}
                        title={
                          selected.isBookmarked
                            ? "Remove bookmark"
                            : "Bookmark discussion"
                        }
                      >
                        <Bookmark
                          size={14}
                          style={{ marginRight: 4 }}
                          fill={selected.isBookmarked ? "currentColor" : "none"}
                        />
                        {selected.isBookmarked ? "Saved" : "Save"}
                      </button>
                    ) : null}
                    {isOwnPost && (
                      <>
                        <button
                          type="button"
                          className="lc-hint-reveal-btn"
                          onClick={() => {
                            setEditTitle(selected.title);
                            setEditContent(selected.content);
                            setEditingPost(true);
                          }}
                        >
                          <Pencil size={14} style={{ marginRight: 4 }} />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="lc-hint-reveal-btn"
                          onClick={() => void handleDeletePost()}
                        >
                          <Trash2 size={14} style={{ marginRight: 4 }} />
                          Delete
                        </button>
                      </>
                    )}
                    {authenticated && !isOwnPost && (
                      <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                        <select
                          value={reportReason}
                          onChange={(e) => setReportReason(e.target.value)}
                          style={{
                            fontSize: "0.75rem",
                            padding: "4px 6px",
                            borderRadius: 6,
                            border: "1px solid var(--border-subtle)",
                            background: "var(--bg-card)",
                            color: "inherit",
                          }}
                        >
                          {REPORT_REASONS.map((r) => (
                            <option key={r} value={r}>
                              {r.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="lc-hint-reveal-btn"
                          disabled={reporting}
                          onClick={() => void handleReportPost()}
                        >
                          <Flag size={14} style={{ marginRight: 4 }} />
                          Report
                        </button>
                      </span>
                    )}
                  </div>
                </>
              )}
            </section>

            <section className="learn-card">
              <h2>Comments</h2>
              {comments.length === 0 ? (
                <p className="empty-state">No comments yet.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {comments.map((c) => {
                    const isOwn = userId && c.authorId === userId;
                    const editing = editingCommentId === c._id;
                    return (
                      <li
                        key={c._id}
                        style={{
                          padding: "10px 0",
                          borderBottom: "1px solid var(--border-subtle)",
                        }}
                      >
                        <strong>{c.authorName}</strong>
                        {editing ? (
                          <>
                            <textarea
                              className="lc-notes-area"
                              rows={2}
                              value={editCommentText}
                              onChange={(e) => setEditCommentText(e.target.value)}
                              style={{ marginTop: 4 }}
                            />
                            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                              <button
                                type="button"
                                className="lc-hint-reveal-btn"
                                onClick={() => void handleUpdateComment(c._id)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="lc-hint-reveal-btn"
                                onClick={() => setEditingCommentId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              style={{
                                whiteSpace: "pre-wrap",
                                marginTop: 4,
                              }}
                            >
                              {c.content}
                            </div>
                            {isOwn && (
                              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                <button
                                  type="button"
                                  className="lc-hint-reveal-btn"
                                  style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                                  onClick={() => {
                                    setEditingCommentId(c._id);
                                    setEditCommentText(c.content);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="lc-hint-reveal-btn"
                                  style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                                  onClick={() => void handleDeleteComment(c._id)}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {authenticated && (
                <div style={{ marginTop: 16 }}>
                  <textarea
                    className="lc-notes-area"
                    rows={3}
                    placeholder="Add a comment…"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <button
                    type="button"
                    className="lc-hint-reveal-btn"
                    style={{ marginTop: 8 }}
                    onClick={() => void handleComment()}
                  >
                    Post comment
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="learn-layout animate-fade-in">
      <header className="learn-header">
        <div>
          <h1>
            <MessageSquare size={22} /> Discussions
          </h1>
          <p>Share solutions and ask questions with the community.</p>
        </div>
      </header>

      {error && (
        <p style={{ color: "var(--danger, #ef4444)", marginBottom: 12 }}>
          {error}
        </p>
      )}

      {authenticated && (
        <section className="learn-card" style={{ marginBottom: 16 }}>
          <h2>New post</h2>
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: "100%",
              marginBottom: 8,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-input, var(--bg-card))",
              color: "inherit",
            }}
          />
          <textarea
            className="lc-notes-area"
            rows={4}
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <button
            type="button"
            className="lc-hint-reveal-btn"
            style={{ marginTop: 8 }}
            disabled={creating}
            onClick={() => void handleCreate()}
          >
            {creating ? "Posting…" : "Create post"}
          </button>
        </section>
      )}

      {loading ? (
        <div className="loading-center">
          <Loader2 size={20} className="spin" /> Loading posts…
        </div>
      ) : posts.length === 0 ? (
        <div className="placeholder-tab">
          <MessageSquare
            size={40}
            color="var(--primary)"
            style={{ marginBottom: 12 }}
          />
          <h2>No posts yet</h2>
          <p>Be the first to start a discussion.</p>
        </div>
      ) : (
        <div className="learn-card">
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {posts.map((post) => (
              <li
                key={post._id}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid var(--border-subtle)",
                  cursor: "pointer",
                }}
                onClick={() => void openPost(post)}
              >
                <div style={{ fontWeight: 600 }}>{post.title}</div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--text-secondary)",
                    marginTop: 4,
                  }}
                >
                  {post.authorName} · {post.upvotes} upvotes · {post.commentCount}{" "}
                  comments
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

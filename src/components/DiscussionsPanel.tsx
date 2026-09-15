import { useCallback, useEffect, useState, type FC } from "react";
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  ThumbsUp,
} from "lucide-react";
import {
  discussionApi,
  type DiscussionComment,
  type DiscussionPost,
} from "../api/discussionApi";

interface Props {
  authenticated?: boolean;
}

export const DiscussionsPanel: FC<Props> = ({ authenticated }) => {
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

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await discussionApi.listPosts({ page: 1, limit: 50, sortBy: "recent" });
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
      await discussionApi.createPost({ title: title.trim(), content: content.trim() });
      setTitle("");
      setContent("");
      await loadPosts();
    } catch {
      setError("Failed to create post.");
    } finally {
      setCreating(false);
    }
  };

  const handleVote = async (postId: string) => {
    if (!authenticated) {
      setError("Sign in to vote.");
      return;
    }
    try {
      const res = await discussionApi.votePost(postId, "upvote");
      if (res.data) {
        setPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, ...res.data } : p)));
        if (selected?._id === postId) setSelected((p) => (p ? { ...p, ...res.data } : p));
      }
    } catch {
      setError("Failed to vote.");
    }
  };

  const handleComment = async () => {
    if (!authenticated || !selected || !commentText.trim()) return;
    try {
      await discussionApi.addComment({ postId: selected._id, content: commentText.trim() });
      setCommentText("");
      const res = await discussionApi.getComments(selected._id);
      setComments(res.data || []);
    } catch {
      setError("Failed to add comment.");
    }
  };

  if (selected) {
    return (
      <div className="learn-layout animate-fade-in">
        <header className="learn-header">
          <button type="button" className="platform-icon-btn" onClick={() => setSelected(null)}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>{selected.title}</h1>
            <p>
              by {selected.authorName} · {selected.upvotes} upvotes · {selected.commentCount}{" "}
              comments
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
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{selected.content}</div>
              <button
                type="button"
                className="lc-hint-reveal-btn"
                style={{ marginTop: 16 }}
                onClick={() => void handleVote(selected._id)}
              >
                <ThumbsUp size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                Upvote ({selected.upvotes})
              </button>
            </section>

            <section className="learn-card">
              <h2>Comments</h2>
              {comments.length === 0 ? (
                <p className="empty-state">No comments yet.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {comments.map((c) => (
                    <li
                      key={c._id}
                      style={{
                        padding: "10px 0",
                        borderBottom: "1px solid var(--border-subtle)",
                      }}
                    >
                      <strong>{c.authorName}</strong>
                      <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{c.content}</div>
                    </li>
                  ))}
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
        <p style={{ color: "var(--danger, #ef4444)", marginBottom: 12 }}>{error}</p>
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
          <MessageSquare size={40} color="var(--primary)" style={{ marginBottom: 12 }} />
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
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 4 }}>
                  {post.authorName} · {post.upvotes} upvotes · {post.commentCount} comments
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

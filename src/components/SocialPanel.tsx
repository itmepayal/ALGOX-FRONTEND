import { useCallback, useEffect, useState } from "react";
import { socialApi } from "../api/socialApi";

type Person = { id: string; name: string; avatar: string };
type RequestRow = { requestId: string; user: Person; createdAt: string };
type Activity = { id: string; type: string; sourceId?: string; actor: Person; target: Person; createdAt: string };
type Progression = Awaited<ReturnType<typeof socialApi.progression>>;

export function SocialPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [friends, setFriends] = useState<Person[]>([]);
  const [following, setFollowing] = useState<Person[]>([]);
  const [incoming, setIncoming] = useState<RequestRow[]>([]);
  const [outgoing, setOutgoing] = useState<RequestRow[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [activityCursor, setActivityCursor] = useState<string | null>(null);
  const [progression, setProgression] = useState<Progression | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [friendRows, followingRows, requests, sentRequests, feed, progress] = await Promise.all([
        socialApi.friends(), socialApi.following(), socialApi.requests("incoming"), socialApi.requests("outgoing"), socialApi.activity(), socialApi.progression(),
      ]);
      setFriends(friendRows); setFollowing(followingRows); setIncoming(requests); setOutgoing(sentRequests); setActivity(feed.items);
      setActivityCursor(feed.nextCursor);
      setProgression(progress);
      setError("");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not load your social activity. Check your connection and retry.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const search = async () => {
    if (query.trim().length < 2) { setResults([]); return; }
    setBusyId("search");
    try { setResults(await socialApi.discover(query.trim())); setError(""); }
    catch (err: any) { setError(err?.response?.data?.message || "Could not search for users."); }
    finally { setBusyId(""); }
  };

  const act = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    try { await action(); await reload(); if (query.trim().length >= 2) setResults(await socialApi.discover(query.trim())); }
    catch (err: any) { setError(err?.response?.data?.message || "That social action failed. Please retry."); }
    finally { setBusyId(""); }
  };

  const followingIds = new Set(following.map((person) => person.id));
  const friendIds = new Set(friends.map((person) => person.id));
  const requestIds = new Set(incoming.map((item) => item.user.id));
  const outgoingIds = new Set(outgoing.map((item) => item.user.id));

  const loadMoreActivity = async () => {
    if (!activityCursor) return;
    try {
      const next = await socialApi.activity(30, activityCursor);
      setActivity((current) => [...current, ...next.items]);
      setActivityCursor(next.nextCursor);
    } catch (err: any) { setError(err?.response?.data?.message || "Could not load more activity."); }
  };

  return <main className="social-page">
    <header className="social-page-header"><div><p className="social-eyebrow">COMMUNITY</p><h1>Friends & activity</h1><p>Find people, manage connections, and see real relationship activity.</p></div><button type="button" onClick={() => void reload()} disabled={loading}>Refresh</button></header>
    {error && <div className="social-error" role="alert"><span>{error}</span><button type="button" onClick={() => void reload()}>Retry</button></div>}
    <section className="social-card">
      <h2>Find people</h2><form onSubmit={(e) => { e.preventDefault(); void search(); }}><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email" aria-label="Search users" maxLength={50} /><button type="submit" disabled={busyId === "search"}>Search</button></form>
      {results.map((person) => <div className="social-person" key={person.id}><span>{person.name}</span><span className="social-actions">
        {!friendIds.has(person.id) && !requestIds.has(person.id) && !outgoingIds.has(person.id) && <button disabled={busyId === person.id} onClick={() => void act(person.id, () => socialApi.sendRequest(person.id))}>Add friend</button>}
        <button disabled={busyId === person.id || followingIds.has(person.id)} onClick={() => void act(person.id, () => socialApi.follow(person.id))}>{followingIds.has(person.id) ? "Following" : "Follow"}</button>
      </span></div>)}
      {query.length >= 2 && !busyId && !results.length && <p className="social-muted">No matching users found.</p>}
    </section>
    <section className="social-card social-progression"><h2>XP & achievements</h2>{progression ? <>
      <div className="social-xp-summary"><strong>Level {progression.level}</strong><span>{progression.xp.toLocaleString()} XP</span></div>
      <progress value={progression.xpIntoLevel} max={500} aria-label={`${progression.xpToNextLevel} XP to next level`} />
      <p className="social-muted">{progression.xpToNextLevel} XP to level {progression.level + 1}</p>
      <div className="social-achievements">{progression.achievements.map((achievement) => <div className="social-achievement" key={achievement.id}>
        <span><strong>{achievement.title}</strong><small>{achievement.description}</small></span>
        <span>{achievement.unlockedAt ? "Unlocked" : `${achievement.progress}/${achievement.target}`}</span>
      </div>)}</div>
    </> : <p className="social-muted">{loading ? "Loading progression…" : "XP is awarded for verified unique problem solves."}</p>}</section>
    <div className="social-columns">
      <section className="social-card"><h2>Friend requests</h2>{loading ? <p>Loading requests…</p> : incoming.length ? incoming.map((row) => <div className="social-person" key={row.requestId}><span>{row.user.name}</span><span className="social-actions"><button disabled={busyId === row.requestId} onClick={() => void act(row.requestId, () => socialApi.respond(row.requestId, "accept"))}>Accept</button><button disabled={busyId === row.requestId} onClick={() => void act(row.requestId, () => socialApi.respond(row.requestId, "reject"))}>Reject</button></span></div>) : <p className="social-muted">No pending requests.</p>}</section>
      <section className="social-card"><h2>Sent requests</h2>{loading ? <p>Loading requests…</p> : outgoing.length ? outgoing.map((row) => <div className="social-person" key={row.requestId}><span>{row.user.name}</span><button disabled={busyId === row.requestId} onClick={() => void act(row.requestId, () => socialApi.respond(row.requestId, "cancel"))}>Cancel</button></div>) : <p className="social-muted">No sent requests.</p>}</section>
      <section className="social-card"><h2>Friends <small>{friends.length}</small></h2>{loading ? <p>Loading friends…</p> : friends.length ? friends.map((person) => <div className="social-person" key={person.id}><span>{person.name}</span><button disabled={busyId === person.id} onClick={() => void act(person.id, () => socialApi.removeFriend(person.id))}>Remove</button></div>) : <p className="social-muted">Your accepted connections will appear here.</p>}</section>
      <section className="social-card"><h2>Following <small>{following.length}</small></h2>{loading ? <p>Loading following…</p> : following.length ? following.map((person) => <div className="social-person" key={person.id}><span>{person.name}</span><button disabled={busyId === person.id} onClick={() => void act(person.id, () => socialApi.unfollow(person.id))}>Unfollow</button></div>) : <p className="social-muted">People you follow will appear here.</p>}</section>
      <section className="social-card"><h2>Activity feed</h2>{loading ? <p>Loading activity…</p> : activity.length ? <>{activity.map((item) => <article className="social-activity" key={item.id}><strong>{item.actor?.name}</strong> {item.type === "friend_added" ? "became friends with" : item.type === "user_followed" ? "followed" : item.type === "battle_won" ? "won a ranked battle" : item.type === "contest_participated" ? "joined a contest" : item.type === "achievement_unlocked" ? "unlocked an achievement" : "solved a problem"} {!["problem_solved", "battle_won", "contest_participated", "achievement_unlocked"].includes(item.type) && <strong>{item.target?.name}</strong>} {item.type === "achievement_unlocked" && <strong>{item.sourceId?.replaceAll("_", " ")}</strong>}<time>{new Date(item.createdAt).toLocaleString()}</time></article>)}{activityCursor && <button type="button" onClick={() => void loadMoreActivity()}>Load more</button>}</> : <p className="social-muted">No activity yet.</p>}</section>
    </div>
  </main>;
}

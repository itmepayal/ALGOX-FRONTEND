import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { connectRealtimeSocket } from "../realtime/socket";

type Snapshot = { sequence: number; code: string; createdAt: string | Date; userId: string };
type Session = {
  id: string; mode: "replay" | "collaborative"; code: string; revision: number;
  status: "active" | "paused" | "completed" | "cancelled"; snapshots: Snapshot[];
};
type Ack = { ok: boolean; session?: Session; status?: number; error?: string; duplicate?: boolean };

export const CodingSessionPanel: FC<{
  problemId: string;
  language: string;
  code: string;
  cursor: { line: number; column: number };
  onRemoteCodeChange: (code: string) => void;
}> = ({ problemId, language, code, cursor, onRemoteCodeChange }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [inviteeId, setInviteeId] = useState("");
  const [joinId, setJoinId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [remoteCursor, setRemoteCursor] = useState<{ userId: string; line: number; column: number; receivedAt: number } | null>(null);
  const socketRef = useRef<ReturnType<typeof connectRealtimeSocket>>(null);
  const latestRef = useRef({ session, code });
  const skipCodeRef = useRef<string | null>(null);
  latestRef.current = { session, code };

  const request = useCallback(async (event: string, payload: unknown): Promise<Ack> => {
    const socket = connectRealtimeSocket();
    socketRef.current = socket;
    if (!socket) throw new Error("Sign in to use coding sessions.");
    if (!socket.connected) await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("Realtime connection timed out. Retry when online.")), 8000);
      socket.once("connect", () => { window.clearTimeout(timer); resolve(); });
      socket.once("connect_error", () => { window.clearTimeout(timer); reject(new Error("Could not connect to the realtime service.")); });
    });
    return await new Promise<Ack>((resolve) => {
      socket.emit(event, payload, (response: Ack) => resolve(response));
      window.setTimeout(() => resolve({ ok: false, error: "The coding session request timed out." }), 10_000);
    });
  }, []);

  const accept = (response: Ack) => {
    if (!response.ok || !response.session) throw new Error(response.error || "Coding session request failed.");
    setSession(response.session);
    if (response.session.mode === "collaborative" && response.session.code !== latestRef.current.code) {
      skipCodeRef.current = response.session.code;
      onRemoteCodeChange(response.session.code);
    }
    setPosition(Math.max(0, response.session.snapshots.length - 1));
    setError("");
    return response.session;
  };
  const snapshots = session?.snapshots || [];
  const selected = snapshots[position];

  const create = async (mode: "replay" | "collaborative") => {
    setBusy(true);
    try {
      const invitees = mode === "collaborative" && inviteeId.trim() ? [inviteeId.trim()] : [];
      accept(await request("coding:session:create", { problemId, mode, language, code, inviteeIds: invitees }));
    } catch (err) { setError(err instanceof Error ? err.message : "Could not start coding session."); }
    finally { setBusy(false); }
  };

  const join = async () => {
    setBusy(true);
    try { accept(await request("coding:session:join", { sessionId: joinId.trim() })); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not join coding session."); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    const socket = connectRealtimeSocket();
    socketRef.current = socket;
    if (!socket) return;
    const onState = (next: Session) => {
      const current = latestRef.current.session;
      if (!current || next.id !== current.id || next.revision < current.revision) return;
      setSession(next);
      if (next.code !== latestRef.current.code) {
        skipCodeRef.current = next.code;
        onRemoteCodeChange(next.code);
      }
    };
    const onCursor = (next: { sessionId: string; userId: string; line: number; column: number }) => {
      if (latestRef.current.session?.id === next.sessionId) setRemoteCursor({ ...next, receivedAt: Date.now() });
    };
    const rejoin = () => {
      const current = latestRef.current.session;
      if (!current) return;
      socket.emit("coding:session:join", { sessionId: current.id }, (response: Ack) => {
        if (response.ok && response.session) {
          setSession(response.session);
          if (response.session.mode === "collaborative" && response.session.code !== latestRef.current.code) {
            skipCodeRef.current = response.session.code;
            onRemoteCodeChange(response.session.code);
          }
        }
      });
    };
    socket.on("coding:session:state", onState);
    socket.on("coding:session:cursor-state", onCursor);
    socket.on("connect", rejoin);
    if (socket.connected) rejoin();
    return () => { socket.off("coding:session:state", onState); socket.off("coding:session:cursor-state", onCursor); socket.off("connect", rejoin); };
  }, [onRemoteCodeChange]);

  useEffect(() => {
    if (!remoteCursor) return;
    const timer = window.setTimeout(() => setRemoteCursor((current) => current?.receivedAt === remoteCursor.receivedAt ? null : current), 6000);
    return () => window.clearTimeout(timer);
  }, [remoteCursor]);

  useEffect(() => {
    const current = session;
    if (!current || current.mode !== "collaborative" || current.status !== "active") return;
    const timer = window.setTimeout(() => {
      socketRef.current?.emit("coding:session:cursor", { sessionId: current.id, line: cursor.line, column: cursor.column });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [cursor, session]);

  useEffect(() => {
    const current = latestRef.current.session;
    if (!current || current.status !== "active") return;
    if (skipCodeRef.current === code) { skipCodeRef.current = null; return; }
    if (code === current.code) return;
    const timer = window.setTimeout(async () => {
      const currentSession = latestRef.current.session;
      if (!currentSession || currentSession.status !== "active") return;
      try {
        const response = await request("coding:session:update", {
          sessionId: currentSession.id,
          eventId: crypto.randomUUID(),
          baseRevision: currentSession.revision,
          code: latestRef.current.code,
        });
        if (!response.ok || !response.session) {
          if (response.status === 409) setError("Another participant edited first. Rejoin to load the latest code.");
          else setError(response.error || "Could not sync editor changes.");
          return;
        }
        setSession(response.session);
      } catch (err) { setError(err instanceof Error ? err.message : "Could not sync editor changes."); }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [code, request]);

  useEffect(() => {
    if (!playing || snapshots.length < 2) return;
    const timer = window.setInterval(() => {
      setPosition((p) => {
        if (p >= snapshots.length - 1) { setPlaying(false); return p; }
        return p + 1;
      });
    }, 1200 / speed);
    return () => window.clearInterval(timer);
  }, [playing, snapshots.length, speed]);

  const finish = async (status: "completed" | "cancelled") => {
    if (!session) return;
    setBusy(true);
    try { accept(await request("coding:session:complete", { sessionId: session.id, status })); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not end session."); }
    finally { setBusy(false); }
  };

  const controlRecording = async (action: "pause" | "resume") => {
    if (!session) return;
    setBusy(true);
    try { accept(await request("coding:session:control", { sessionId: session.id, action })); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update recording state."); }
    finally { setBusy(false); }
  };

  return <section className="coding-session-panel" aria-label="Code replay and collaboration">
    <div className="coding-session-actions">
      <button type="button" disabled={busy} onClick={() => void create("replay")}>Start replay recording</button>
      <input aria-label="Invite participant user ID" placeholder="Participant user ID" value={inviteeId} onChange={(e) => setInviteeId(e.target.value)} />
      <button type="button" disabled={busy} onClick={() => void create("collaborative")}>Create shared session</button>
      <input aria-label="Coding session ID" placeholder="Session ID to join" value={joinId} onChange={(e) => setJoinId(e.target.value)} />
      <button type="button" disabled={busy || !joinId.trim()} onClick={() => void join()}>Join session</button>
    </div>
    {session && <div className="coding-session-status">
      <span>{session.mode === "replay" ? "Replay recording" : "Collaborative session"} · {session.status} · revision {session.revision}</span>
      <code>{session.id}</code>
      {session.mode === "collaborative" && remoteCursor && <small>Participant {remoteCursor.userId.slice(0, 6)}… at line {remoteCursor.line}, column {remoteCursor.column}</small>}
      {session.status === "active" && session.mode === "replay" && <button type="button" disabled={busy} onClick={() => void controlRecording("pause")}>Pause recording</button>}
      {session.status === "paused" && session.mode === "replay" && <button type="button" disabled={busy} onClick={() => void controlRecording("resume")}>Resume recording</button>}
      {["active", "paused"].includes(session.status) && session.mode === "replay" && <button type="button" disabled={busy} onClick={() => void finish("completed")}>Finish recording</button>}
      {session.status === "active" && session.mode === "collaborative" && <button type="button" disabled={busy} onClick={() => void finish("completed")}>End session</button>}
    </div>}
    {session && session.mode === "replay" && snapshots.length > 0 && <div className="coding-replay-controls">
      <label>Replay snapshot <input type="range" min={0} max={snapshots.length - 1} value={position} onChange={(e) => setPosition(Number(e.target.value))} /></label>
      <span>{selected ? new Date(selected.createdAt).toLocaleTimeString() : ""}</span>
      <label>Speed <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
      <button type="button" onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
      <button type="button" onClick={() => { setPlaying(false); setPosition((p) => Math.max(0, p - 1)); }}>Previous</button>
      <button type="button" onClick={() => { setPlaying(false); setPosition((p) => Math.min(snapshots.length - 1, p + 1)); }}>Next</button>
      <pre aria-label="Replay code snapshot">{selected?.code || ""}</pre>
      <small>{position + 1} / {snapshots.length} · playback speed {speed}×</small>
    </div>}
    {error && <p role="alert" className="coding-session-error">{error}</p>}
  </section>;
};

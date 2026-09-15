import { useCallback, useEffect, useState, type FC } from "react";
import { Newspaper, StickyNote } from "lucide-react";
import { PermissionGuard } from "../shared/PermissionGuard";
import { DataTable } from "../shared/DataTable";
import { adminContentApi } from "../../../api/adminContentApi";
import { ArticlesAdmin } from "./ArticlesAdminPage";
import { StudyPlansAdmin } from "./StudyPlansAdminPage";

type ContentMode = "articles" | "tutorials" | "study-plans" | "notes" | "editorials";

export const ContentAdminPage: FC<{ mode: ContentMode }> = ({ mode }) => {
  if (mode === "study-plans") return <StudyPlansAdmin />;
  if (mode === "notes") return <NotesAdmin />;
  if (mode === "editorials") return <EditorialsAdmin />;
  // articles + tutorials share article model (category filter for tutorials)
  return <ArticlesAdmin category={mode === "tutorials" ? "tutorial" : undefined} />;
};

const EditorialsAdmin: FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [problemId, setProblemId] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminContentApi.listEditorials({ page: 1, limit: 50 });
      setRows(res.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PermissionGuard permission="content:view">
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          className="admin-input"
          placeholder="Problem ID for empty editorial stub"
          value={problemId}
          onChange={(e) => setProblemId(e.target.value)}
        />
        <button
          type="button"
          className="admin-btn"
          onClick={() =>
            void adminContentApi
              .upsertEditorial({
                problemId,
                hints: [],
                solutions: [],
                isPremiumOnly: false,
              })
              .then(load)
          }
        >
          Upsert editorial
        </button>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <DataTable
        loading={loading}
        emptyTitle="No editorials yet"
        emptyDescription="Editorials appear once they are linked to problems."
        emptyIcon={<Newspaper size={18} strokeWidth={1.75} />}
        columns={[
          { key: "pid", header: "Problem", render: (r) => r.problemId },
          {
            key: "hints",
            header: "Hints",
            render: (r) => (r.hints || []).length,
          },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <button
                type="button"
                className="admin-link"
                onClick={() =>
                  void adminContentApi.deleteEditorial(r._id || r.id).then(load)
                }
              >
                Delete
              </button>
            ),
          },
        ]}
        rows={rows}
        rowKey={(r) => String(r._id || r.id)}
      />
    </PermissionGuard>
  );
};

const NotesAdmin: FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminContentApi.listNotes({ page: 1, limit: 50 });
      setRows(res.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PermissionGuard permission="content:view">
      <button type="button" className="admin-btn" style={{ marginBottom: 12 }} onClick={() => void load()}>
        Refresh
      </button>
      <DataTable
        loading={loading}
        emptyTitle="No user notes yet"
        emptyDescription="Private user notes will show up here when available."
        emptyIcon={<StickyNote size={18} strokeWidth={1.75} />}
        columns={[
          { key: "user", header: "User", render: (r) => String(r.userId) },
          { key: "problem", header: "Problem", render: (r) => String(r.problemId) },
          {
            key: "note",
            header: "Note",
            render: (r) => String(r.noteText || "").slice(0, 80),
          },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <button
                type="button"
                className="admin-link"
                onClick={() =>
                  void adminContentApi.deleteNote(r._id || r.id).then(load)
                }
              >
                Delete
              </button>
            ),
          },
        ]}
        rows={rows}
        rowKey={(r) => String(r._id || r.id)}
      />
    </PermissionGuard>
  );
};

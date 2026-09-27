import { useState, useEffect, useMemo, type FC, type FormEvent } from "react";
import {
  Trophy,
  Plus,
  RefreshCw,
  Search,
  Archive,
  X,
} from "lucide-react";
import { adminTournamentApi } from "../../../api/adminTournamentApi";
import type { Tournament, TournamentStatus } from "../../../api/tournamentApi";
import { useToast } from "../../../context/ToastContext";

export const AdminTournamentPanel: FC = () => {
  const toast = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMaxParticipants, setFormMaxParticipants] = useState<number>(8);
  const [formStartTime, setFormStartTime] = useState("");

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const res = await adminTournamentApi.listAll();
      if (res.success) {
        setTournaments(res.data);
      }
    } catch (err: any) {
      console.error("Failed to load admin tournaments", err);
      toast.error(err?.response?.data?.message || "Failed to load tournaments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formSlug.trim() || !formStartTime) {
      toast.error("Title, Slug, and Start Time are required");
      return;
    }
    try {
      setActionBusy("create");
      const res = await adminTournamentApi.create({
        title: formTitle.trim(),
        slug: formSlug.trim().toLowerCase(),
        description: formDescription.trim(),
        maxParticipants: formMaxParticipants,
        startTime: new Date(formStartTime).toISOString(),
      });
      if (res.success) {
        toast.success("Tournament created successfully as DRAFT");
        setCreateModalOpen(false);
        setFormTitle("");
        setFormSlug("");
        setFormDescription("");
        fetchTournaments();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create tournament");
    } finally {
      setActionBusy(null);
    }
  };

  const handleAction = async (
    id: string,
    action: "publish" | "openRegistration" | "closeRegistration" | "seed" | "start" | "archive"
  ) => {
    try {
      setActionBusy(`${action}-${id}`);
      let res;
      if (action === "publish") res = await adminTournamentApi.publish(id);
      else if (action === "openRegistration") res = await adminTournamentApi.openRegistration(id);
      else if (action === "closeRegistration") res = await adminTournamentApi.closeRegistration(id);
      else if (action === "seed") res = await adminTournamentApi.seed(id);
      else if (action === "start") res = await adminTournamentApi.start(id);
      else if (action === "archive") res = await adminTournamentApi.archive(id);

      if (res && res.success) {
        toast.success(`Tournament status updated: ${res.data.status}`);
        fetchTournaments();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to execute ${action}`);
    } finally {
      setActionBusy(null);
    }
  };

  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      const matchSearch =
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tournaments, search, statusFilter]);

  const stats = useMemo(() => {
    const total = tournaments.length;
    const draft = tournaments.filter((t) => t.status === "DRAFT").length;
    const regOpen = tournaments.filter((t) => t.status === "REGISTRATION_OPEN").length;
    const inProgress = tournaments.filter((t) => t.status === "IN_PROGRESS").length;
    const completed = tournaments.filter((t) => t.status === "COMPLETED").length;
    return { total, draft, regOpen, inProgress, completed };
  }, [tournaments]);

  const renderStatusBadge = (status: TournamentStatus) => {
    switch (status) {
      case "DRAFT":
        return <span className="ax-badge bg-gray-500/10 text-gray-400 border border-gray-500/20">DRAFT</span>;
      case "PUBLISHED":
        return <span className="ax-badge bg-blue-500/10 text-blue-400 border border-blue-500/20">PUBLISHED</span>;
      case "REGISTRATION_OPEN":
        return <span className="ax-badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">REG OPEN</span>;
      case "REGISTRATION_CLOSED":
        return <span className="ax-badge bg-amber-500/10 text-amber-400 border border-amber-500/20">REG CLOSED</span>;
      case "SEEDED":
        return <span className="ax-badge bg-purple-500/10 text-purple-400 border border-purple-500/20">SEEDED</span>;
      case "IN_PROGRESS":
        return <span className="ax-badge bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">LIVE</span>;
      case "COMPLETED":
        return <span className="ax-badge bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">COMPLETED</span>;
      case "ARCHIVED":
        return <span className="ax-badge bg-gray-700/20 text-gray-500 border border-gray-700/30">ARCHIVED</span>;
      default:
        return <span className="ax-badge text-gray-400">{status}</span>;
    }
  };

  return (
    <div className="ax-workspace animate-fade-in space-y-6">
      {/* Header */}
      <div className="ax-hero-compact flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-2">
            <Trophy className="w-3.5 h-3.5" />
            <span>Admin Orchestration Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Tournament Management</h1>
          <p className="text-sm text-gray-400 mt-1">
            Configure single-elimination knockout tournament brackets, manage status transitions, and audit participation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="ax-btn ax-btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Tournament</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="ax-stat-block">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Total Tournaments</div>
          <div className="text-2xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="ax-stat-block">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Drafts</div>
          <div className="text-2xl font-bold text-gray-400">{stats.draft}</div>
        </div>
        <div className="ax-stat-block">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Reg. Open</div>
          <div className="text-2xl font-bold text-emerald-400">{stats.regOpen}</div>
        </div>
        <div className="ax-stat-block">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">In Progress</div>
          <div className="text-2xl font-bold text-cyan-400">{stats.inProgress}</div>
        </div>
        <div className="ax-stat-block">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Completed</div>
          <div className="text-2xl font-bold text-indigo-400">{stats.completed}</div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="ax-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search title or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-900/80 border border-gray-700/60 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-xs text-gray-400 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-900/80 border border-gray-700/60 text-sm text-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500/50"
          >
            <option value="all">All Statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="REGISTRATION_OPEN">REGISTRATION_OPEN</option>
            <option value="REGISTRATION_CLOSED">REGISTRATION_CLOSED</option>
            <option value="SEEDED">SEEDED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>

          <button
            onClick={fetchTournaments}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tournaments List Table */}
      {filteredTournaments.length === 0 ? (
        <div className="ax-card py-12 text-center text-gray-400">
          <Trophy className="w-10 h-10 mx-auto mb-3 text-gray-600" />
          <p className="text-base font-medium text-white mb-1">No tournaments found</p>
          <p className="text-sm text-gray-400">Create a new tournament to start orchestrating knockout competitions.</p>
        </div>
      ) : (
        <div className="ax-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-900/90 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
                <tr>
                  <th className="p-4">Tournament</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Participants</th>
                  <th className="p-4">Start Time</th>
                  <th className="p-4 text-right">Lifecycle Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredTournaments.map((t) => {
                  const tId = t.id || t._id!;
                  return (
                    <tr key={tId} className="hover:bg-gray-900/40 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-white">{t.title}</div>
                        <div className="text-xs text-gray-400 font-mono">/{t.slug}</div>
                      </td>
                      <td className="p-4">{renderStatusBadge(t.status)}</td>
                      <td className="p-4">
                        <span className="text-white font-medium">{t.participantCount}</span>
                        <span className="text-gray-500"> / {t.maxParticipants} max</span>
                      </td>
                      <td className="p-4 text-gray-300">
                        {new Date(t.startTime).toLocaleString()}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {t.status === "DRAFT" && (
                            <button
                              onClick={() => handleAction(tId, "publish")}
                              disabled={Boolean(actionBusy)}
                              className="ax-btn ax-btn-secondary text-xs"
                            >
                              Publish
                            </button>
                          )}

                          {t.status === "PUBLISHED" && (
                            <button
                              onClick={() => handleAction(tId, "openRegistration")}
                              disabled={Boolean(actionBusy)}
                              className="ax-btn ax-btn-primary text-xs bg-emerald-600 hover:bg-emerald-500"
                            >
                              Open Reg.
                            </button>
                          )}

                          {t.status === "REGISTRATION_OPEN" && (
                            <button
                              onClick={() => handleAction(tId, "closeRegistration")}
                              disabled={Boolean(actionBusy)}
                              className="ax-btn ax-btn-secondary text-xs"
                            >
                              Close Reg.
                            </button>
                          )}

                          {t.status === "REGISTRATION_CLOSED" && (
                            <button
                              onClick={() => handleAction(tId, "seed")}
                              disabled={Boolean(actionBusy) || t.participantCount !== t.maxParticipants}
                              className="ax-btn ax-btn-primary text-xs bg-purple-600 hover:bg-purple-500"
                              title={
                                t.participantCount !== t.maxParticipants
                                  ? `Requires exactly ${t.maxParticipants} participants`
                                  : "Seed Bracket Tree"
                              }
                            >
                              Seed Bracket
                            </button>
                          )}

                          {t.status === "SEEDED" && (
                            <button
                              onClick={() => handleAction(tId, "start")}
                              disabled={Boolean(actionBusy)}
                              className="ax-btn ax-btn-primary text-xs bg-cyan-600 hover:bg-cyan-500"
                            >
                              Start Live
                            </button>
                          )}

                          {t.status !== "ARCHIVED" && (
                            <button
                              onClick={() => handleAction(tId, "archive")}
                              disabled={Boolean(actionBusy)}
                              className="p-1.5 text-gray-500 hover:text-rose-400 rounded-lg transition-colors"
                              title="Archive Tournament"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Tournament Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="ax-card max-w-lg w-full p-6 relative border-purple-500/30">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-white mb-1">Create New Tournament</h2>
            <p className="text-xs text-gray-400 mb-4">
              Tournaments are initialized as DRAFT. Configure bracket parameters before publishing.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AlgoPath Knockout Championship #01"
                  value={formTitle}
                  onChange={(e) => {
                    setFormTitle(e.target.value);
                    if (!formSlug) {
                      setFormSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-"));
                    }
                  }}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  required
                  placeholder="algopath-knockout-01"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Single-elimination 1v1 battle tournament..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Max Participants
                  </label>
                  <select
                    value={formMaxParticipants}
                    onChange={(e) => setFormMaxParticipants(Number(e.target.value))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value={8}>8 Participants (3 Rounds)</option>
                    <option value={16}>16 Participants (4 Rounds)</option>
                    <option value={32}>32 Participants (5 Rounds)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="ax-btn ax-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionBusy === "create"}
                  className="ax-btn ax-btn-primary"
                >
                  {actionBusy === "create" ? "Creating..." : "Create Tournament"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

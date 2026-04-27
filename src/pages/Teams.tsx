import { useState } from "react";
import { trpc } from "@/trpc";
import { useStack } from "@/components/layout/StackContext";
import {
  Users,
  Plus,
  Trash2,
  Loader2,
  Bot,
  Crown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import HelpTooltip from "@/components/HelpTooltip";

type Agent = { id: number; name: string; hierarchyRole: string | null; isEnabled: boolean | null; modelName: string | null };

export default function Teams() {
  const { stackId } = useStack();
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [orchestratorId, setOrchestratorId] = useState<number | null>(null);
  const [memberAgentId, setMemberAgentId] = useState<number | null>(null);
  const [memberRole, setMemberRole] = useState("worker");

  const { data: agents } = trpc.agent.list.useQuery({ stackId });
  const { data: teams, isLoading } = trpc.team.list.useQuery({ stackId });
  const createMutation = trpc.team.create.useMutation({
    onSuccess: () => {
      utils.team.list.invalidate({ stackId });
      setName("");
      setDescription("");
      setOrchestratorId(null);
      setShowAdd(false);
    },
  });
  const deleteMutation = trpc.team.delete.useMutation({
    onSuccess: () => utils.team.list.invalidate({ stackId }),
  });
  const addMemberMutation = trpc.team.addMember.useMutation({
    onSuccess: () => {
      utils.team.getById.invalidate({ stackId, teamId: expandedTeam! });
      setMemberAgentId(null);
    },
  });
  const removeMemberMutation = trpc.team.removeMember.useMutation({
    onSuccess: () => {
      utils.team.getById.invalidate({ stackId, teamId: expandedTeam! });
    },
  });

  const orchestrators: Agent[] = agents?.filter((a: Agent) => a.hierarchyRole === "orchestrator") ?? [];
  const workers: Agent[] = agents?.filter((a: Agent) => a.hierarchyRole !== "orchestrator") ?? [];

  function handleCreate() {
    if (!name.trim() || !orchestratorId) return;
    createMutation.mutate({ stackId, name, description, orchestratorAgentId: orchestratorId });
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
            <Users className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">Teams <HelpTooltip text="Multi-agent teams use an Orchestrator agent to plan tasks and delegate to Worker agents. The Orchestrator then synthesizes all responses into a single coherent answer." /></h1>
            <p className="text-xs text-gray-500">Create agent teams for multi-agent collaboration</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          {showAdd ? "Cancel" : "New Team"}
        </button>
      </div>

      {/* Create Team Form */}
      {showAdd && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Create Team</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Content Team"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Orchestrator</label>
              <select
                value={orchestratorId ?? ""}
                onChange={(e) => setOrchestratorId(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              >
                <option value="">Select orchestrator agent...</option>
                {orchestrators.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {orchestrators.length === 0 && (
                <p className="mt-1 text-[10px] text-amber-600">
                  No orchestrator agents found. Set an agent&apos;s hierarchy role to &quot;orchestrator&quot; first.
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Handles content generation and review"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending || !name.trim() || !orchestratorId}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Team
            </button>
          </div>
        </div>
      )}

      {/* Teams List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
          </div>
        ) : teams && teams.length > 0 ? (
          teams.map((team: NonNullable<typeof teams>[number]) => (
            <TeamCard
              key={team.id}
              team={team}
              stackId={stackId}
              agents={agents ?? []}
              workers={workers}
              expanded={expandedTeam === team.id}
              onToggle={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
              onDelete={() => {
                if (confirm("Deactivate this team?")) deleteMutation.mutate({ stackId, teamId: team.id });
              }}
              memberAgentId={memberAgentId}
              setMemberAgentId={setMemberAgentId}
              memberRole={memberRole}
              setMemberRole={setMemberRole}
              onAddMember={(teamId) => {
                if (memberAgentId) {
                  addMemberMutation.mutate({ stackId, teamId, agentId: memberAgentId, role: memberRole });
                }
              }}
              onRemoveMember={(memberId) => removeMemberMutation.mutate({ stackId, memberId })}
              isAddingMember={addMemberMutation.isPending}
            />
          ))
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <Users className="mx-auto mb-3 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">No teams yet.</p>
            <p className="mt-1 text-xs text-gray-400">
              Create a team to enable multi-agent collaboration.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamCard({
  team,
  stackId,
  agents,
  workers,
  expanded,
  onToggle,
  onDelete,
  memberAgentId,
  setMemberAgentId,
  memberRole,
  setMemberRole,
  onAddMember,
  onRemoveMember,
  isAddingMember,
}: {
  team: { id: number; name: string; description: string | null; orchestratorAgentId: number; memberCount: number };
  stackId: number;
  agents: Array<{ id: number; name: string; hierarchyRole: string | null }>;
  workers: Array<{ id: number; name: string; hierarchyRole: string | null }>;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  memberAgentId: number | null;
  setMemberAgentId: (id: number | null) => void;
  memberRole: string;
  setMemberRole: (role: string) => void;
  onAddMember: (teamId: number) => void;
  onRemoveMember: (memberId: number) => void;
  isAddingMember: boolean;
}) {
  const { data: teamDetail } = trpc.team.getById.useQuery(
    { stackId, teamId: team.id },
    { enabled: expanded }
  );

  const orchestrator = agents.find((a) => a.id === team.orchestratorAgentId);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
            <Users className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">{team.name}</div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Crown className="h-3 w-3 text-amber-500" />
                {orchestrator?.name ?? "Unknown"}
              </span>
              <span>·</span>
              <span>{team.memberCount} member(s)</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          {team.description && <p className="mb-3 text-xs text-gray-500">{team.description}</p>}

          {/* Members */}
          <div className="mb-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Members</h4>
            {teamDetail?.members && teamDetail.members.length > 0 ? (
              <div className="space-y-1">
                {teamDetail.members.map((m: typeof teamDetail.members[number]) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Bot className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-sm text-gray-700">{m.agent?.name ?? `Agent ${m.agentId}`}</span>
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600">{m.role}</span>
                    </div>
                    <button
                      onClick={() => onRemoveMember(m.id)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No members yet.</p>
            )}
          </div>

          {/* Add Member */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] font-medium text-gray-500">Add Agent</label>
              <select
                value={memberAgentId ?? ""}
                onChange={(e) => setMemberAgentId(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
              >
                <option value="">Select agent...</option>
                {workers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-gray-500">Role</label>
              <select
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
                className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
              >
                <option value="worker">worker</option>
                <option value="reviewer">reviewer</option>
                <option value="specialist">specialist</option>
              </select>
            </div>
            <button
              onClick={() => onAddMember(team.id)}
              disabled={!memberAgentId || isAddingMember}
              className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

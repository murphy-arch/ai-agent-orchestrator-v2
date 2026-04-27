import { useState } from "react";
import {
  Loader2,
  KeyRound,
  Users,
  Info,
  Plus,
  Trash2,
  AlertCircle,
  Shield,
  Crown,
  UserCircle,
  Mail,
  ChevronDown,
  Copy,
  Check,
  Settings2,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { trpc } from "@/trpc";
import { useStack } from "@/components/layout/StackContext";

// ─── API Keys Section ───

function ApiKeysSection({ stackId, userRole }: { stackId: number; userRole: string }) {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.settings.getStackSettings.useQuery({ stackId });
  const { data: mpStatus } = trpc.settings.hasMasterPassword.useQuery();

  const [showAddForm, setShowAddForm] = useState(false);
  const [provider, setProvider] = useState<"openai" | "anthropic" | "google">("openai");
  const [label, setLabel] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Master password state
  const [masterPassword, setMasterPassword] = useState("");
  const [mpModalOpen, setMpModalOpen] = useState(false);
  const [mpMode, setMpMode] = useState<"set" | "verify">("verify");
  const [mpError, setMpError] = useState("");
  const [revealedKeys, setRevealedKeys] = useState<Record<number, string>>({});
  const [isRevealed, setIsRevealed] = useState(false);

  const addMutation = trpc.settings.addApiKey.useMutation({
    onSuccess: () => {
      utils.settings.getStackSettings.invalidate({ stackId });
      setShowAddForm(false);
      setLabel("");
      setKeyValue("");
      setError("");
    },
    onError: (err) => setError(err.message),
  });

  const deleteMutation = trpc.settings.deleteApiKey.useMutation({
    onSuccess: () => {
      utils.settings.getStackSettings.invalidate({ stackId });
    },
  });

  const setMpMutation = trpc.settings.setMasterPassword.useMutation({
    onSuccess: () => {
      utils.settings.hasMasterPassword.invalidate();
      setMpModalOpen(false);
      setMasterPassword("");
      setMpError("");
    },
    onError: (err) => setMpError(err.message),
  });

  const verifyMpMutation = trpc.settings.verifyMasterPassword.useMutation({
    onSuccess: (data) => {
      if (data.valid) {
        setMpModalOpen(false);
        setMasterPassword("");
        setMpError("");
        setIsRevealed(true);
        // Load decrypted keys
        utils.settings.listApiKeysDecrypted
          .fetch({ stackId, masterPassword })
          .then((keys) => {
            const map: Record<number, string> = {};
            keys.forEach((k) => {
              map[k.id] = k.keyValue;
            });
            setRevealedKeys(map);
          })
          .catch(() => setIsRevealed(false));
      } else {
        setMpError(data.error || "Invalid master password");
      }
    },
    onError: (err) => setMpError(err.message),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!label.trim() || !keyValue.trim()) {
      setError("Label and key value are required");
      return;
    }
    addMutation.mutate({ stackId, provider, keyLabel: label.trim(), keyValue: keyValue.trim() });
  };

  const handleCopy = (id: number) => {
    const value = revealedKeys[id];
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const openMpModal = (mode: "set" | "verify") => {
    setMpMode(mode);
    setMpModalOpen(true);
    setMpError("");
    setMasterPassword("");
  };

  const handleMpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMpError("");
    if (!masterPassword.trim()) {
      setMpError("Password is required");
      return;
    }
    if (mpMode === "set") {
      setMpMutation.mutate({ password: masterPassword.trim() });
    } else {
      verifyMpMutation.mutate({ password: masterPassword.trim() });
    }
  };

  const canManage = userRole === "owner" || userRole === "admin";

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <KeyRound className="h-4 w-4 text-gray-500" />
          API Keys
        </h2>
        <div className="flex items-center gap-2">
          {mpStatus?.set ? (
            <button
              onClick={() => (isRevealed ? setIsRevealed(false) : openMpModal("verify"))}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {isRevealed ? (
                <>
                  <EyeOff className="h-3 w-3" /> Hide Values
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" /> Reveal
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => openMpModal("set")}
              className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
            >
              <Lock className="h-3 w-3" /> Set Master Password
            </button>
          )}
          {canManage && (
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Key
            </button>
          )}
        </div>
      </div>

      {/* Master Password Modal */}
      {mpModalOpen && (
        <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-4">
          <form onSubmit={handleMpSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">
                {mpMode === "set" ? "Set Master Password" : "Enter Master Password"}
              </label>
              <input
                type="password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                placeholder={mpMode === "set" ? "Min 4 characters" : "Your master password"}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              {mpMode === "set" && (
                <p className="mt-1 text-xs text-gray-500">
                  This password protects all API key values. You will need it to view or copy keys.
                </p>
              )}
            </div>
            {mpError && (
              <p className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3 w-3" />
                {mpError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMpModalOpen(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={setMpMutation.isPending || verifyMpMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {(setMpMutation.isPending || verifyMpMutation.isPending) && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                {mpMode === "set" ? "Set Password" : "Unlock"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showAddForm && canManage && (
        <form onSubmit={handleAdd} className="border-b border-gray-100 bg-gray-50/50 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Provider</label>
              <div className="relative mt-1">
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as typeof provider)}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Production Key"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Key Value</label>
              <input
                type="password"
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                placeholder="sk-..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          {error && (
            <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {addMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Save Key
            </button>
          </div>
        </form>
      )}

      <div className="px-5 py-3">
        {isLoading ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : !settings?.apiKeys || settings.apiKeys.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No API keys configured</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {settings.apiKeys.map(
              (key: {
                id: number;
                provider: string;
                keyLabel: string;
                isActive: boolean;
              }) => (
                <div key={key.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100">
                      <KeyRound className="h-4 w-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{key.keyLabel}</p>
                      <p className="text-xs text-gray-500">
                        {key.provider} · {key.isActive ? "Active" : "Inactive"}
                        {isRevealed && revealedKeys[key.id] && (
                          <span className="ml-2 font-mono text-xs text-gray-400">
                            {revealedKeys[key.id].slice(0, 8)}···
                            {revealedKeys[key.id].slice(-4)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isRevealed && revealedKeys[key.id] && (
                      <button
                        onClick={() => handleCopy(key.id)}
                        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                        title="Copy key"
                      >
                        {copiedId === key.id ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    {canManage && (
                      <button
                        onClick={() => deleteMutation.mutate({ stackId, keyId: key.id })}
                        disabled={deleteMutation.isPending}
                        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Delete key"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Members Section ───

function MemberRoleIcon({ role }: { role: string }) {
  switch (role) {
    case "owner":
      return <Crown className="h-4 w-4 text-amber-500" />;
    case "admin":
      return <Shield className="h-4 w-4 text-blue-500" />;
    default:
      return <UserCircle className="h-4 w-4 text-gray-400" />;
  }
}

function MembersSection({ stackId, userRole }: { stackId: number; userRole: string }) {
  const utils = trpc.useUtils();
  const { data: members, isLoading } = trpc.stack.getMembers.useQuery({ stackId });

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [error, setError] = useState("");

  const inviteMutation = trpc.stack.inviteMember.useMutation({
    onSuccess: () => {
      utils.stack.getMembers.invalidate({ stackId });
      setShowInviteForm(false);
      setEmail("");
      setError("");
    },
    onError: (err) => setError(err.message),
  });

  const removeMutation = trpc.stack.removeMember.useMutation({
    onSuccess: () => {
      utils.stack.getMembers.invalidate({ stackId });
    },
  });

  const canManage = userRole === "owner" || userRole === "admin";

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    inviteMutation.mutate({ stackId, email: email.trim(), role: inviteRole });
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Users className="h-4 w-4 text-gray-500" />
          Members
        </h2>
        {canManage && (
          <button
            onClick={() => setShowInviteForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Invite
          </button>
        )}
      </div>

      {showInviteForm && canManage && (
        <form onSubmit={handleInvite} className="border-b border-gray-100 bg-gray-50/50 px-5 py-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700">Email</label>
              <div className="relative mt-1">
                <Mail className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Role</label>
              <div className="relative mt-1">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                  className="w-28 appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          </div>
          {error && (
            <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowInviteForm(false)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviteMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {inviteMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Send Invite
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-gray-100 px-5">
        {(!members || members.length === 0) && (
          <p className="py-6 text-center text-sm text-gray-400">No members</p>
        )}
        {members?.map(
          (member: {
            id: number;
            userId: number;
            name: string | null;
            email: string;
            role: string;
          }) => (
            <div key={member.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <MemberRoleIcon role={member.role} />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {member.name ?? member.email}
                  </p>
                  <p className="text-xs text-gray-500">
                    {member.email} ·{" "}
                    <span className="capitalize">{member.role}</span>
                  </p>
                </div>
              </div>
              {canManage && member.role !== "owner" && (
                <button
                  onClick={() => removeMutation.mutate({ stackId, userId: member.userId })}
                  disabled={removeMutation.isPending}
                  className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  title="Remove member"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── Stack Info Section ───

function StackInfoSection({ stack }: { stack?: { name: string; slug: string; status: string } | null }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Info className="h-4 w-4 text-gray-500" />
          Stack Information
        </h2>
      </div>
      <div className="px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-gray-500">Name</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{stack?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Slug</p>
            <p className="mt-1 text-sm text-gray-700">{stack?.slug ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Status</p>
            <p className="mt-1">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  stack?.status === "active"
                    ? "bg-green-50 text-green-700"
                    : stack?.status === "archived"
                    ? "bg-gray-100 text-gray-600"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {stack?.status ?? "active"}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Settings Page ───

type Tab = "general" | "keys" | "members";

const TAB_CONFIG: { id: Tab; label: string; icon: typeof Info }[] = [
  { id: "general", label: "General", icon: Info },
  { id: "keys", label: "API Keys", icon: KeyRound },
  { id: "members", label: "Members", icon: Users },
];

export default function Settings() {
  const { stackId } = useStack();
  const { data: stack } = trpc.stack.getById.useQuery({ stackId });
  const { data: members } = trpc.stack.getMembers.useQuery({ stackId });
  const { data: me } = trpc.auth.me.useQuery();
  const [activeTab, setActiveTab] = useState<Tab>("general");

  const myMembership = members?.find((m) => m.userId === me?.id);
  const userRole = myMembership?.role ?? "member";

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
          <Settings2 className="h-5 w-5 text-gray-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Settings</h1>
          <p className="text-xs text-gray-500">Manage your stack configuration</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {TAB_CONFIG.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === "general" && <StackInfoSection stack={stack} />}
        {activeTab === "keys" && <ApiKeysSection stackId={stackId} userRole={userRole} />}
        {activeTab === "members" && <MembersSection stackId={stackId} userRole={userRole} />}
      </div>
    </div>
  );
}

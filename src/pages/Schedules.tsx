import { useState } from "react";
import { trpc } from "@/trpc";
import { useStack } from "@/components/layout/StackContext";
import { useToast } from "@/components/ToastProvider";
import {
  Clock,
  Plus,
  Trash2,
  Play,
  Loader2,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Edit3,
  LayoutTemplate,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Globe,
} from "lucide-react";
import HelpTooltip from "@/components/HelpTooltip";
import { SCHEDULE_TEMPLATES, SCHEDULE_CATEGORIES, COMMON_TIMEZONES } from "@/lib/schedule-templates";
import {
  buildCronExpression,
  parseCronExpression,
  describeCronSelection,
  HOUR12_OPTIONS,
  MINUTE_OPTIONS,
  AMPM_OPTIONS,
  WEEKDAY_OPTIONS,
  MONTHLY_DAY_OPTIONS,
  type CronSelection,
  type Frequency,
} from "@/lib/cron-builder";
import { CronTime } from "cron";

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function getNextRun(expression: string, timezone?: string): Date | null {
  try {
    const ct = new CronTime(expression, timezone || undefined);
    const next = ct.getNextDateFrom(new Date());
    return next.toJSDate();
  } catch {
    return null;
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);
  if (diffMins < 1) return "in < 1 min";
  if (diffMins < 60) return `in ${diffMins} min`;
  if (diffHours < 24) return `in ${diffHours} hr`;
  return `in ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
}

function CronReadout({ expression, showNextRun }: { expression: string; showNextRun?: boolean }) {
  const parsed = parseCronExpression(expression);
  const nextRun = showNextRun ? getNextRun(expression) : null;
  if (!parsed) {
    return (
      <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-700">
        {expression}
      </code>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-600">
        {expression}
      </code>
      <span className="text-[10px] text-gray-400">=</span>
      <span className="text-xs font-medium text-purple-700">
        {describeCronSelection(parsed)}
      </span>
      {nextRun && (
        <span className="text-[10px] text-green-600 font-medium">
          · Next: {formatRelativeTime(nextRun)}
        </span>
      )}
    </div>
  );
}

function CronBuilderForm({
  value,
  onChange,
}: {
  value: CronSelection;
  onChange: (v: CronSelection) => void;
}) {
  const toggleWeeklyDay = (day: number) => {
    const has = value.weeklyDays.includes(day);
    onChange({
      ...value,
      weeklyDays: has
        ? value.weeklyDays.filter((d) => d !== day)
        : [...value.weeklyDays, day],
    });
  };

  const toggleMonthlyDay = (day: number) => {
    const has = value.monthlyDays.includes(day);
    onChange({
      ...value,
      monthlyDays: has
        ? value.monthlyDays.filter((d) => d !== day)
        : [...value.monthlyDays, day],
    });
  };

  return (
    <div className="space-y-4">
      {/* Time row */}
      <div className="flex items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Hour</label>
          <select
            value={value.hour12}
            onChange={(e) => onChange({ ...value, hour12: parseInt(e.target.value, 10) })}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          >
            {HOUR12_OPTIONS.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </div>
        <span className="pb-2 text-sm text-gray-400">:</span>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Minute</label>
          <select
            value={value.minute}
            onChange={(e) => onChange({ ...value, minute: parseInt(e.target.value, 10) })}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          >
            {MINUTE_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">AM/PM</label>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {AMPM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...value, ampm: opt.value })}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  value.ampm === opt.value
                    ? "bg-purple-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Frequency */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">Frequency</label>
        <select
          value={value.frequency}
          onChange={(e) =>
            onChange({
              ...value,
              frequency: e.target.value as Frequency,
              weeklyDays: [],
              monthlyDays: [],
            })
          }
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 sm:w-auto"
        >
          {FREQUENCY_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Weekly day selector */}
      {value.frequency === "weekly" && (
        <div>
          <label className="mb-2 block text-xs font-medium text-gray-700">Day(s) of the week</label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_OPTIONS.map((day) => {
              const isSelected = value.weeklyDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleWeeklyDay(day.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? "border-purple-500 bg-purple-600 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          {value.weeklyDays.length === 0 && (
            <p className="mt-1 text-[10px] text-red-500">Select at least one day</p>
          )}
        </div>
      )}

      {/* Monthly day selector */}
      {value.frequency === "monthly" && (
        <div>
          <label className="mb-2 block text-xs font-medium text-gray-700">Day(s) of the month</label>
          <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-8">
            {MONTHLY_DAY_OPTIONS.map((day) => {
              const isSelected = value.monthlyDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleMonthlyDay(day.value)}
                  className={`rounded-md border px-1 py-1 text-[11px] font-medium transition-colors ${
                    isSelected
                      ? "border-purple-500 bg-purple-600 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {day.value}
                </button>
              );
            })}
          </div>
          {value.monthlyDays.length === 0 && (
            <p className="mt-1 text-[10px] text-red-500">Select at least one day</p>
          )}
        </div>
      )}

      {/* Result readout */}
      <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-3">
        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
          Generated Cron Expression
        </p>
        <p className="mt-1 text-sm font-semibold text-purple-700">
          {describeCronSelection(value)}
        </p>
        <code className="mt-1 inline-block rounded bg-white px-2 py-0.5 text-[10px] font-mono text-gray-500">
          {buildCronExpression(value)}
        </code>
      </div>
    </div>
  );
}

const DEFAULT_CRON: CronSelection = {
  hour12: 9,
  minute: 0,
  ampm: "am",
  frequency: "daily",
  weeklyDays: [],
  monthlyDays: [],
};

export default function Schedules() {
  const { stackId } = useStack();
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCronGuide, setShowCronGuide] = useState(false);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [cronSelection, setCronSelection] = useState<CronSelection>(DEFAULT_CRON);
  const [inputMessage, setInputMessage] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: user } = trpc.auth.me.useQuery();
  const userTimezone = user?.timezone || "UTC";

  const { data: scheduleList, isLoading } = trpc.schedule.list.useQuery({ stackId });
  const createMutation = trpc.schedule.create.useMutation({
    onSuccess: () => {
      utils.schedule.list.invalidate({ stackId });
      resetForm();
      setShowAdd(false);
    },
  });
  const updateMutation = trpc.schedule.update.useMutation({
    onSuccess: () => {
      utils.schedule.list.invalidate({ stackId });
      resetForm();
      setEditingId(null);
    },
  });
  const deleteMutation = trpc.schedule.delete.useMutation({
    onSuccess: () => utils.schedule.list.invalidate({ stackId }),
  });
  const { success: showSuccess } = useToast();
  const runNowMutation = trpc.schedule.runNow.useMutation({
    onSuccess: (_, vars) => {
      utils.schedule.list.invalidate({ stackId });
      const sched = scheduleList?.find((s) => s.id === vars.scheduleId);
      showSuccess(sched ? `Triggered "${sched.name}"` : "Schedule triggered");
    },
  });

  function resetForm() {
    setName("");
    setCronSelection(DEFAULT_CRON);
    setInputMessage("");
    setIsActive(true);
  }

  function startEdit(schedule: NonNullable<typeof scheduleList>[number]) {
    setEditingId(schedule.id);
    setName(schedule.name);
    const parsed = parseCronExpression(schedule.cronExpression);
    setCronSelection(parsed ?? DEFAULT_CRON);
    setInputMessage(schedule.inputMessage);
    setIsActive(schedule.isActive ?? true);
  }

  function handleSave() {
    const cronExpression = buildCronExpression(cronSelection);
    if (editingId) {
      updateMutation.mutate({
        stackId,
        scheduleId: editingId,
        name,
        cronExpression,
        inputMessage,
        timezone: userTimezone,
        isActive,
      });
    } else {
      createMutation.mutate({
        stackId,
        name,
        cronExpression,
        inputMessage,
        timezone: userTimezone,
        isActive,
      });
    }
  }

  function applyTemplate(template: (typeof SCHEDULE_TEMPLATES)[number]) {
    createMutation.mutate(
      {
        stackId,
        name: template.name,
        cronExpression: buildCronExpression(template.cron),
        inputMessage: template.inputMessage,
        timezone: userTimezone,
        isActive: true,
      },
      {
        onSuccess: () => {
          setAppliedTemplateId(template.id);
          setTimeout(() => setAppliedTemplateId(null), 2000);
        },
      }
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const canSave =
    name.trim() &&
    inputMessage.trim() &&
    (cronSelection.frequency === "daily" ||
      (cronSelection.frequency === "weekly" && cronSelection.weeklyDays.length > 0) ||
      (cronSelection.frequency === "monthly" && cronSelection.monthlyDays.length > 0));

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
            <CalendarClock className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              Schedules{" "}
              <HelpTooltip text="Cron schedules run your workflow automatically at set times. The Input Message is what gets passed into your workflow as the starting prompt." />
            </h1>
            <p className="text-xs text-gray-500">Automate workflows with cron triggers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowTemplates(!showTemplates);
              setShowAdd(false);
              setShowCronGuide(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100"
          >
            <LayoutTemplate className="h-4 w-4" />
            {showTemplates ? "Hide Templates" : "Templates"}
          </button>
          <button
            onClick={() => {
              resetForm();
              setEditingId(null);
              setShowAdd(!showAdd);
              setShowTemplates(false);
              setShowCronGuide(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            {showAdd ? "Cancel" : "New Schedule"}
          </button>
        </div>
      </div>

      {/* Timezone banner */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-700">
        <Globe className="h-4 w-4" />
        <span>Schedules run in your timezone:</span>
        <span className="font-semibold">
          {COMMON_TIMEZONES.find((tz) => tz.value === userTimezone)?.label ?? userTimezone}
        </span>
        <a href="/settings" className="ml-auto underline hover:text-blue-800">
          Change
        </a>
      </div>

      {/* Schedule Templates Gallery */}
      {showTemplates && (
        <div className="mb-6 space-y-4">
          <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-5">
            <div className="mb-1 flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-semibold text-gray-900">Quick Templates</h3>
            </div>
            <p className="mb-4 text-xs text-gray-500">
              Click any template to instantly create a pre-configured schedule.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {SCHEDULE_TEMPLATES.map((template) => {
                const isExpanded = expandedTemplateId === template.id;
                const cat = SCHEDULE_CATEGORIES[template.category];
                return (
                  <div
                    key={template.id}
                    className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-purple-300"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        {template.name}
                      </span>
                      {appliedTemplateId === template.id && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      )}
                    </div>
                    <p className="mb-2 flex-1 text-xs text-gray-500">
                      {template.description}
                    </p>

                    {/* Friendly timing readout */}
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          cat?.color ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {cat?.label ?? template.category}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                        <Clock className="h-3 w-3" />
                        {describeCronSelection(template.cron)}
                      </span>
                    </div>

                    {/* Expandable raw cron */}
                    {isExpanded && (
                      <div className="mb-2 rounded bg-gray-50 p-2">
                        <CronReadout expression={buildCronExpression(template.cron)} />
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => applyTemplate(template)}
                        disabled={createMutation.isPending}
                        className="flex flex-1 items-center justify-center rounded-md bg-purple-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        {appliedTemplateId === template.id ? "Created!" : "Use Template"}
                      </button>
                      <button
                        onClick={() =>
                          setExpandedTemplateId(isExpanded ? null : template.id)
                        }
                        className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                        title="Show cron"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cron Reference Guide */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <button
              onClick={() => setShowCronGuide(!showCronGuide)}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">How Cron Works Under the Hood</h3>
              </div>
              {showCronGuide ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {showCronGuide && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: "Minute", range: "0–59" },
                    { label: "Hour", range: "0–23" },
                    { label: "Day of Month", range: "1–31" },
                    { label: "Month", range: "1–12" },
                    { label: "Day of Week", range: "0–6" },
                  ].map((f) => (
                    <div
                      key={f.label}
                      className="rounded-lg border border-purple-100 bg-purple-50/50 p-2 text-center"
                    >
                      <div className="text-[10px] font-semibold text-purple-700 uppercase">
                        {f.label}
                      </div>
                      <div className="text-[10px] text-gray-500">{f.range}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded bg-amber-50 p-3 text-xs text-amber-800">
                  <span className="font-semibold">Special characters:</span>{" "}
                  <code className="font-mono">*</code> = any value,{" "}
                  <code className="font-mono">-</code> = range,{" "}
                  <code className="font-mono">,</code> = list,{" "}
                  <code className="font-mono">*/n</code> = every n
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Form */}
      {showAdd && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            {editingId ? "Edit Schedule" : "Create Schedule"}
          </h3>
          <div className="grid gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Daily Report"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <CronBuilderForm value={cronSelection} onChange={setCronSelection} />

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Input Message
              </label>
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="What should the workflow do when triggered?"
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Active
              </label>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAdd(false);
                setEditingId(null);
                resetForm();
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !canSave}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Schedules Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Clock className="h-4 w-4 text-gray-500" />
            Active Schedules
            <HelpTooltip text="Schedules that are currently enabled will trigger automatically. Disabled schedules remain in the list but won't run until re-enabled." />
          </h2>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            </div>
          ) : scheduleList && scheduleList.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">When</th>
                  <th className="px-5 py-3">Input</th>
                  <th className="px-5 py-3">Last Run</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scheduleList.map((schedule: NonNullable<typeof scheduleList>[number]) => (
                  <tr key={schedule.id} className="transition-colors hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      {schedule.isActive ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-400" />
                      )}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">{schedule.name}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-0.5">
                        <CronReadout expression={schedule.cronExpression} showNextRun={schedule.isActive} />
                        {schedule.timezone && schedule.timezone !== "UTC" && (
                          <span className="text-[10px] text-gray-400">
                            {COMMON_TIMEZONES.find((tz) => tz.value === schedule.timezone)?.label ?? schedule.timezone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-xs truncate px-5 py-3 text-gray-500">
                      {schedule.inputMessage}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {schedule.lastRunAt
                        ? new Date(schedule.lastRunAt).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => runNowMutation.mutate({ stackId, scheduleId: schedule.id })}
                          disabled={runNowMutation.isPending}
                          title="Run now"
                          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-purple-600"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            startEdit(schedule);
                            setShowAdd(true);
                          }}
                          title="Edit"
                          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            deleteMutation.mutate({ stackId, scheduleId: schedule.id })
                          }
                          title="Delete"
                          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">
              No schedules yet. Create one or pick a template to automate your workflows.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

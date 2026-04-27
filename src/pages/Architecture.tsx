import { useState, useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  Panel,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Save,
  RotateCcw,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Bot,
  Zap,
  Play,
  MessageSquare,
  X,
  ArrowRight,
  LogIn,
  LogOut,
  Brain,
  Settings,
  BookOpen,
  Users,
  Pencil,
  Shield,
  GitBranch,
} from "lucide-react";
import { trpc } from "@/trpc";
import { useStack } from "@/components/layout/StackContext";
import HelpTooltip from "@/components/HelpTooltip";
import { useFlowStore } from "@/stores/flowStore";
import InputConfigModal from "@/components/flow/InputConfigModal";
import OutputConfigModal from "@/components/flow/OutputConfigModal";
import TriggerConfigModal from "@/components/flow/TriggerConfigModal";
import ConditionConfigModal from "@/components/flow/ConditionConfigModal";
import HumanGatewayConfigModal from "@/components/flow/HumanGatewayConfigModal";
import ConditionNode from "@/components/flow/ConditionNode";
import AgentEditModal from "@/components/flow/AgentEditModal";

// ─── Module-level callback for agent edit from nodes ───
const agentEditRef = { current: null as ((agentId: number) => void) | null };

// ─── Custom Node Components ───

function AgentNode({ data }: { data: { label: string; role?: string; agentId?: number; functionName?: string | null; skills?: string[] } }) {
  const roleColors: Record<string, string> = {
    orchestrator: "border-purple-500 bg-purple-50",
    manager: "border-blue-500 bg-blue-50",
    worker: "border-emerald-500 bg-emerald-50",
  };
  const roleIconColors: Record<string, string> = {
    orchestrator: "text-purple-600",
    manager: "text-blue-600",
    worker: "text-emerald-600",
  };
  const roleBadgeColors: Record<string, string> = {
    orchestrator: "bg-purple-100 text-purple-700 border-purple-200",
    manager: "bg-blue-100 text-blue-700 border-blue-200",
    worker: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
  const roleSkillColors: Record<string, string> = {
    orchestrator: "bg-white text-purple-700 border-purple-200",
    manager: "bg-white text-blue-700 border-blue-200",
    worker: "bg-white text-emerald-700 border-emerald-200",
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.agentId && agentEditRef.current) {
      agentEditRef.current(data.agentId);
    }
  };

  return (
    <div
      className={`min-w-[200px] max-w-[260px] rounded-xl border-2 p-3.5 shadow-md relative group ${
        roleColors[data.role ?? "worker"]
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-400 !w-2 !h-2" />
      {/* Edit button */}
      {data.agentId && (
        <button
          onClick={handleEdit}
          className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-white border-2 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50 z-10"
          title="Edit agent"
        >
          <Pencil className="h-3.5 w-3.5 text-gray-500" />
        </button>
      )}

      {/* Top row: icon + name + role badge */}
      <div className="flex items-start gap-2">
        <Bot className={`h-5 w-5 shrink-0 mt-0.5 ${roleIconColors[data.role ?? "worker"]}`} />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-bold text-gray-900 leading-tight block truncate">{data.label}</span>
          {data.role && (
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${roleBadgeColors[data.role ?? "worker"]}`}>
              {data.role}
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="my-2 border-t border-gray-200/70" />

      {/* Function name */}
      {data.functionName && (
        <div className="text-xs font-semibold text-gray-800 truncate mb-1.5">
          {data.functionName}
        </div>
      )}

      {/* Skills */}
      {data.skills && data.skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.skills.map((skill) => (
            <span
              key={skill}
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold border ${roleSkillColors[data.role ?? "worker"]}`}
            >
              {skill}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-gray-400 !w-2 !h-2" />
    </div>
  );
}

function TriggerNode({ data }: { data: { label: string } }) {
  return (
    <div className="min-w-[120px] rounded-lg border-2 border-amber-400 bg-amber-50 p-3 shadow-sm">
      <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-medium text-gray-900">{data.label}</span>
      </div>
    </div>
  );
}

function InputNode({ data }: { data: { label: string } }) {
  return (
    <div className="min-w-[120px] rounded-lg border-2 border-green-400 bg-green-50 p-3 shadow-sm">
      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <LogIn className="h-4 w-4 text-green-600" />
        <span className="text-sm font-medium text-gray-900">{data.label}</span>
      </div>
    </div>
  );
}

function OutputNode({ data }: { data: { label: string } }) {
  return (
    <div className="min-w-[120px] rounded-lg border-2 border-rose-400 bg-rose-50 p-3 shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-rose-500 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <LogOut className="h-4 w-4 text-rose-600" />
        <span className="text-sm font-medium text-gray-900">{data.label}</span>
      </div>
    </div>
  );
}

function MemoryNode({ data }: { data: { label: string } }) {
  return (
    <div className="min-w-[120px] rounded-lg border-2 border-purple-400 bg-purple-50 p-3 shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-purple-500 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-purple-600" />
        <span className="text-sm font-medium text-gray-900">{data.label}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-purple-500 !w-2 !h-2" />
    </div>
  );
}

function KnowledgeNode({ data }: { data: { label: string } }) {
  return (
    <div className="min-w-[120px] rounded-lg border-2 border-teal-400 bg-teal-50 p-3 shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-teal-500 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-teal-600" />
        <span className="text-sm font-medium text-gray-900">{data.label}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-teal-500 !w-2 !h-2" />
    </div>
  );
}

function VariableSetNode({ data }: { data: { label: string } }) {
  return (
    <div className="min-w-[120px] rounded-lg border-2 border-cyan-400 bg-cyan-50 p-3 shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-cyan-500 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <Settings className="h-4 w-4 text-cyan-600" />
        <span className="text-sm font-medium text-gray-900">{data.label}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-cyan-500 !w-2 !h-2" />
    </div>
  );
}

function DelayNode({ data }: { data: { label: string; delayMs?: number } }) {
  return (
    <div className="min-w-[120px] rounded-lg border-2 border-amber-400 bg-amber-50 p-3 shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-amber-500 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-medium text-gray-900">{data.label}</span>
      </div>
      {data.delayMs && (
        <span className="text-[10px] text-amber-700">{data.delayMs}ms</span>
      )}
      <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-2 !h-2" />
    </div>
  );
}

function LoopNode({ data }: { data: { label: string; maxIterations?: number } }) {
  return (
    <div className="min-w-[120px] rounded-lg border-2 border-indigo-400 bg-indigo-50 p-3 shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-indigo-500 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <RotateCcw className="h-4 w-4 text-indigo-600" />
        <span className="text-sm font-medium text-gray-900">{data.label}</span>
      </div>
      {data.maxIterations && (
        <span className="text-[10px] text-indigo-700">max {data.maxIterations}</span>
      )}
      <Handle type="source" position={Position.Right} className="!bg-indigo-500 !w-2 !h-2" />
    </div>
  );
}

function ParallelNode({ data }: { data: { label: string } }) {
  return (
    <div className="min-w-[120px] rounded-lg border-2 border-pink-400 bg-pink-50 p-3 shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-pink-500 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <Play className="h-4 w-4 text-pink-600" />
        <span className="text-sm font-medium text-gray-900">{data.label}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-pink-500 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-pink-500 !w-2 !h-2" />
    </div>
  );
}

function TeamNode({ data }: { data: { label: string; teamName?: string } }) {
  return (
    <div className="min-w-[140px] rounded-lg border-2 border-violet-400 bg-violet-50 p-3 shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-violet-500 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-violet-600" />
        <span className="text-sm font-medium text-gray-900">{data.label}</span>
      </div>
      {data.teamName && (
        <span className="text-[10px] text-violet-700">{data.teamName}</span>
      )}
      <Handle type="source" position={Position.Right} className="!bg-violet-500 !w-2 !h-2" />
    </div>
  );
}

function HumanGatewayNode({ data }: { data: { label: string; approvalPrompt?: string; timeoutMinutes?: number } }) {
  return (
    <div className="min-w-[160px] rounded-lg border-2 border-orange-400 bg-orange-50 p-3 shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-orange-500 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-orange-600" />
        <span className="text-sm font-medium text-gray-900">{data.label}</span>
      </div>
      {data.approvalPrompt && (
        <span className="block text-[10px] text-orange-700 truncate max-w-[140px]" title={data.approvalPrompt}>
          {data.approvalPrompt}
        </span>
      )}
      {data.timeoutMinutes ? (
        <span className="text-[10px] text-orange-600">⏱ {data.timeoutMinutes}m</span>
      ) : (
        <span className="text-[10px] text-orange-600">⏱ no timeout</span>
      )}
      <Handle type="source" position={Position.Right} className="!bg-orange-500 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-red-400 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = {
  agent: AgentNode,
  trigger: TriggerNode,
  input: InputNode,
  output: OutputNode,
  memory: MemoryNode,
  knowledge: KnowledgeNode,
  "variable-set": VariableSetNode,
  delay: DelayNode,
  loop: LoopNode,
  parallel: ParallelNode,
  team: TeamNode,
  "human-gateway": HumanGatewayNode,
  condition: ConditionNode,
};

let nextNodeIdCounter = 1;

export default function Architecture() {
  const { stackId } = useStack();
  const utils = trpc.useUtils();
  const flowStore = useFlowStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [showAddNode, setShowAddNode] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);
  const initialHashRef = useRef<string>("");

  // ─── Run workflow state ───
  const [showRunModal, setShowRunModal] = useState(false);
  const [runInput, setRunInput] = useState("");
  const [runResults, setRunResults] = useState<Array<{ nodeId: number; agentName?: string; response: string }> | null>(null);
  const [showResults, setShowResults] = useState(false);

  // ─── Node config modals ───
  const [showInputConfig, setShowInputConfig] = useState(false);
  const [showOutputConfig, setShowOutputConfig] = useState(false);
  const [showTriggerConfig, setShowTriggerConfig] = useState(false);
  const [showConditionConfig, setShowConditionConfig] = useState(false);
  const [showHumanGatewayConfig, setShowHumanGatewayConfig] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<number | null>(null);

  const { data: workflowData, isLoading } = trpc.workflow.load.useQuery(
    { stackId },
    { refetchOnWindowFocus: false, staleTime: 0 }
  );
  const { data: agents } = trpc.agent.list.useQuery({ stackId });
  const { data: agentFunctions } = trpc.agentFunction.list.useQuery();

  const saveMutation = trpc.workflow.save.useMutation({
    onSuccess: () => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      utils.workflow.load.invalidate({ stackId });
      // Reset unsaved changes baseline
      initialHashRef.current = JSON.stringify({
        nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label })),
      });
    },
    onError: (err) => {
      console.error("[Workflow Save Error]", err);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
  });

  const runMutation = trpc.execution.executeWorkflow.useMutation({
    onSuccess: (data) => {
      setRunResults(data.outputs ?? []);
      setShowResults(true);
      setShowRunModal(false);
      setRunInput("");
    },
    onError: (err) => {
      setRunResults([{ nodeId: 0, agentName: "System", response: `Error: ${err.message}` }]);
      setShowResults(true);
      setShowRunModal(false);
    },
  });

  // Load workflow data into canvas and flow store (only once)
  useEffect(() => {
    if (hasLoadedRef.current) return;
    if (workflowData) {
      hasLoadedRef.current = true;
      const loadedNodes: Node[] =
        workflowData.nodes?.map((n: {
          id: number;
          agentId?: number | null;
          type: string;
          positionX?: number | null;
          positionY?: number | null;
          data?: Record<string, unknown>;
        }) => ({
          id: String(n.id),
          type: n.type,
          position: {
            x: n.positionX ?? Math.random() * 400,
            y: n.positionY ?? Math.random() * 300,
          },
          data: n.data ?? { label: `Node ${n.id}` },
        })) ?? [];

      const nodeIdSet = new Set(loadedNodes.map((n) => n.id));

      const allLoadedEdges: Edge[] =
        workflowData.edges?.map((e: {
          id: number;
          sourceId: number;
          targetId: number;
          condition?: string | null;
        }) => ({
          id: String(e.id),
          source: String(e.sourceId),
          target: String(e.targetId),
          label: e.condition ?? undefined,
        })) ?? [];

      // Filter out orphaned edges (edges whose source/target nodes don't exist)
      const loadedEdges = allLoadedEdges.filter(
        (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)
      );
      const orphanedCount = allLoadedEdges.length - loadedEdges.length;
      if (orphanedCount > 0) {
        console.warn(`[workflow load] Filtered out ${orphanedCount} orphaned edges (missing source/target nodes)`);
      }

      setNodes(loadedNodes);
      setEdges(loadedEdges);
      initialHashRef.current = JSON.stringify({ nodes: loadedNodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })), edges: loadedEdges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label })) });
      flowStore.loadFromDb(
        loadedNodes.map((n) => ({ id: n.id, type: n.type ?? "default", position: n.position, data: n.data as Record<string, unknown> })),
        loadedEdges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label }))
      );

      // Set nextNodeId based on existing nodes
      const maxId = loadedNodes.reduce((max: number, n: Node) => {
        const numId = parseInt(n.id, 10);
        return isNaN(numId) ? max : Math.max(max, numId);
      }, 0);
      nextNodeIdCounter = maxId + 1;

      console.log(`[workflow load] loaded ${loadedNodes.length} nodes, ${loadedEdges.length} valid edges (${allLoadedEdges.length} total)`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowData]);

  const onConnect = useCallback(
    (params: Connection) => {
      console.log("[onConnect] params:", params);
      setEdges((eds) => {
        const newEdges = addEdge(params, eds);
        console.log("[onConnect] new edges count:", newEdges.length);
        return newEdges;
      });
      setSelectedEdge(null);
    },
    [setEdges]
  );

  const handleSave = () => {
    setSaveStatus("saving");

    // Map string React Flow IDs to numeric DB IDs
    const idMap = new Map<string, number>();
    let tempCounter = nextNodeIdCounter;

    const mappedNodes = nodes.map((n) => {
      let numId = parseInt(n.id, 10);
      if (isNaN(numId)) {
        numId = tempCounter++;
      }
      idMap.set(n.id, numId);
      return {
        id: numId,
        agentId: n.type === "agent" ? (n.data?.agentId as number | undefined) : undefined,
        type: n.type ?? "agent",
        positionX: Math.round(n.position.x),
        positionY: Math.round(n.position.y),
        data: n.data,
      };
    });

    const mappedEdges: Array<{
      id: number;
      sourceId: number;
      targetId: number;
      condition?: string;
    }> = [];

    for (const e of edges) {
      const sourceNum = idMap.get(e.source);
      const targetNum = idMap.get(e.target);
      if (sourceNum === undefined || targetNum === undefined) {
        console.warn(`[Workflow Save] Skipping orphaned edge ${e.id} (source=${e.source}, target=${e.target} not in nodes)`);
        continue;
      }
      mappedEdges.push({
        id: parseInt(e.id, 10) || tempCounter++,
        sourceId: sourceNum,
        targetId: targetNum,
        condition: e.label ?? undefined,
      });
    }

    nextNodeIdCounter = tempCounter;

    console.log(`[handleSave] saving ${mappedNodes.length} nodes, ${mappedEdges.length} edges (${edges.length - mappedEdges.length} orphaned skipped)`);

    saveMutation.mutate({
      stackId,
      nodes: mappedNodes,
      edges: mappedEdges,
    });
  };

  const handleReset = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    nextNodeIdCounter = 1;
    flowStore.reset();
    setRunResults(null);
    setShowResults(false);
    hasLoadedRef.current = false;
  };

  // Detect unsaved changes
  const hasUnsavedChanges = (() => {
    if (!initialHashRef.current || nodes.length === 0) return false;
    const currentHash = JSON.stringify({
      nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label })),
    });
    return currentHash !== initialHashRef.current;
  })();

  // Warn before closing tab with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  // Close modals on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowInputConfig(false);
        setShowOutputConfig(false);
        setShowTriggerConfig(false);
        setShowConditionConfig(false);
        setShowAddNode(false);
        setShowRunModal(false);
        setShowResults(false);
        setSelectedNode(null);
        setSelectedEdge(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Register edit callback for nodes
  useEffect(() => {
    agentEditRef.current = (agentId: number) => setEditingAgentId(agentId);
    return () => { agentEditRef.current = null; };
  }, []);

  const handleAddAgentNode = (agentId: number, agentName: string, role: string) => {
    const agent = agents?.find((a) => a.id === agentId);
    const func = agentFunctions?.find((f) => f.id === agent?.functionId);
    const newNode: Node = {
      id: `node-${nextNodeIdCounter++}`,
      type: "agent",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 150 },
      data: {
        label: agentName,
        role,
        agentId,
        functionName: func?.name || null,
        skills: ((func?.skills as string[]) || []).slice(0, 3),
      },
    };
    setNodes((prev) => [...prev, newNode]);
    flowStore.addNode({ id: newNode.id, type: newNode.type, position: newNode.position, data: newNode.data as Record<string, unknown> });
    setShowAddNode(false);
  };

  const handleAddTriggerNode = () => {
    const newNode: Node = {
      id: `trigger-${nextNodeIdCounter++}`,
      type: "trigger",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 150 },
      data: { label: "Trigger" },
    };
    setNodes((prev) => [...prev, newNode]);
    flowStore.addNode({ id: newNode.id, type: newNode.type, position: newNode.position, data: newNode.data as Record<string, unknown> });
    setShowAddNode(false);
  };

  const handleAddInputNode = () => {
    const newNode: Node = {
      id: `input-${nextNodeIdCounter++}`,
      type: "input",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 150 },
      data: { label: "Input" },
    };
    setNodes((prev) => [...prev, newNode]);
    flowStore.addNode({ id: newNode.id, type: newNode.type, position: newNode.position, data: newNode.data as Record<string, unknown> });
    setShowAddNode(false);
  };

  const handleAddOutputNode = () => {
    const newNode: Node = {
      id: `output-${nextNodeIdCounter++}`,
      type: "output",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 150 },
      data: { label: "Output" },
    };
    setNodes((prev) => [...prev, newNode]);
    flowStore.addNode({ id: newNode.id, type: newNode.type, position: newNode.position, data: newNode.data as Record<string, unknown> });
    setShowAddNode(false);
  };

  const handleAddConditionNode = () => {
    const newNode: Node = {
      id: `condition-${nextNodeIdCounter++}`,
      type: "condition",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 150 },
      data: { label: "Condition", operator: "contains", value: "" },
    };
    setNodes((prev) => [...prev, newNode]);
    flowStore.addNode({ id: newNode.id, type: newNode.type, position: newNode.position, data: newNode.data as Record<string, unknown> });
    setShowAddNode(false);
  };

  const handleAddMemoryNode = () => {
    const newNode: Node = {
      id: `memory-${nextNodeIdCounter++}`,
      type: "memory",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 150 },
      data: { label: "Store Memory", memoryKey: "fact", memoryCategory: "workflow" },
    };
    setNodes((prev) => [...prev, newNode]);
    flowStore.addNode({ id: newNode.id, type: newNode.type, position: newNode.position, data: newNode.data as Record<string, unknown> });
    setShowAddNode(false);
  };

  const handleAddKnowledgeNode = () => {
    const newNode: Node = {
      id: `knowledge-${nextNodeIdCounter++}`,
      type: "knowledge",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 150 },
      data: { label: "Knowledge Base", topK: 5, useFallback: true },
    };
    setNodes((prev) => [...prev, newNode]);
    flowStore.addNode({ id: newNode.id, type: newNode.type, position: newNode.position, data: newNode.data as Record<string, unknown> });
    setShowAddNode(false);
  };

  const handleAddVariableSetNode = () => {
    const newNode: Node = {
      id: `var-${nextNodeIdCounter++}`,
      type: "variable-set",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 150 },
      data: { label: "Set Variable", varName: "result" },
    };
    setNodes((prev) => [...prev, newNode]);
    flowStore.addNode({ id: newNode.id, type: newNode.type, position: newNode.position, data: newNode.data as Record<string, unknown> });
    setShowAddNode(false);
  };

  const handleAddDelayNode = () => {
    const newNode: Node = {
      id: `delay-${nextNodeIdCounter++}`,
      type: "delay",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 150 },
      data: { label: "Delay", delayMs: 1000 },
    };
    setNodes((prev) => [...prev, newNode]);
    flowStore.addNode({ id: newNode.id, type: newNode.type, position: newNode.position, data: newNode.data as Record<string, unknown> });
    setShowAddNode(false);
  };

  const handleAddLoopNode = () => {
    const newNode: Node = {
      id: `loop-${nextNodeIdCounter++}`,
      type: "loop",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 150 },
      data: { label: "Loop", maxIterations: 3, loopCondition: "" },
    };
    setNodes((prev) => [...prev, newNode]);
    flowStore.addNode({ id: newNode.id, type: newNode.type, position: newNode.position, data: newNode.data as Record<string, unknown> });
    setShowAddNode(false);
  };

  const handleAddParallelNode = () => {
    const newNode: Node = {
      id: `parallel-${nextNodeIdCounter++}`,
      type: "parallel",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 150 },
      data: { label: "Parallel" },
    };
    setNodes((prev) => [...prev, newNode]);
    flowStore.addNode({ id: newNode.id, type: newNode.type, position: newNode.position, data: newNode.data as Record<string, unknown> });
    setShowAddNode(false);
  };

  const handleAddTeamNode = () => {
    const newNode: Node = {
      id: `team-${nextNodeIdCounter++}`,
      type: "team",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 150 },
      data: { label: "Team", teamId: 0, mode: "parallel" },
    };
    setNodes((prev) => [...prev, newNode]);
    flowStore.addNode({ id: newNode.id, type: newNode.type, position: newNode.position, data: newNode.data as Record<string, unknown> });
    setShowAddNode(false);
  };

  const handleAddHumanGatewayNode = () => {
    const newNode: Node = {
      id: `human-${nextNodeIdCounter++}`,
      type: "human-gateway",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 150 },
      data: { label: "Human Gateway", approvalPrompt: "Please review and approve to continue.", timeoutMinutes: 0, timeoutAction: "approve" },
    };
    setNodes((prev) => [...prev, newNode]);
    flowStore.addNode({ id: newNode.id, type: newNode.type, position: newNode.position, data: newNode.data as Record<string, unknown> });
    setShowAddNode(false);
  };

  const handleDeleteNode = () => {
    if (selectedNode) {
      setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
      setEdges((prev) =>
        prev.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
      );
      flowStore.removeNode(selectedNode.id);
      setSelectedNode(null);
    }
  };

  const handleDeleteEdge = () => {
    if (selectedEdge) {
      setEdges((prev) => prev.filter((e) => e.id !== selectedEdge.id));
      setSelectedEdge(null);
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't delete nodes when user is typing in an input, textarea, or modal
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest("[role='dialog']") !== null;
      if (isTyping) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNode) {
          handleDeleteNode();
        } else if (selectedEdge) {
          handleDeleteEdge();
        }
      }
    },
    [selectedNode, selectedEdge]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    console.log("[edges changed] count:", edges.length, "edges:", edges.map((e) => ({ id: e.id, source: e.source, target: e.target })));
  }, [edges]);

  useEffect(() => {
    console.log("[nodes changed] count:", nodes.length, "ids:", nodes.map((n) => n.id));
  }, [nodes]);

  const handleRun = () => {
    if (!runInput.trim()) return;
    runMutation.mutate({
      stackId,
      message: runInput.trim(),
      nodes: nodes.map((n) => ({
        id: parseInt(n.id, 10) || 0,
        agentId: n.type === "agent" ? (n.data?.agentId as number | undefined) : undefined,
        type: n.type ?? "default",
        positionX: Math.round(n.position.x),
        positionY: Math.round(n.position.y),
        data: n.data ?? {},
      })),
      edges: edges.map((e) => ({
        id: parseInt(e.id, 10) || 0,
        sourceId: parseInt(e.source, 10),
        targetId: parseInt(e.target, 10),
        condition: e.label ?? undefined,
      })),
    });
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col -m-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">Workflow Architecture <HelpTooltip text="A visual canvas where you design agent workflows. Drag nodes (agents, inputs, decisions, delays) onto the canvas and connect them with edges to define execution flow." /></h1>
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-xs font-medium text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              Error saving
            </span>
          )}
          {hasUnsavedChanges && saveStatus === "idle" && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowAddNode((v) => !v)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              Add Node
            </button>
            {showAddNode && (
              <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={handleAddInputNode}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <LogIn className="h-4 w-4 text-green-500" />
                  Add Input Node
                </button>
                <button
                  onClick={handleAddTriggerNode}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Zap className="h-4 w-4 text-amber-500" />
                  Add Trigger Node
                </button>
                <div className="my-1 border-t border-gray-100" />
                {/* Orchestrators */}
                {agents?.some((a) => a.hierarchyRole === "orchestrator") && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50">
                      Orchestrators
                    </div>
                    {agents
                      .filter((a) => a.hierarchyRole === "orchestrator")
                      .map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() =>
                            handleAddAgentNode(agent.id, agent.name, agent.hierarchyRole ?? "worker")
                          }
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-purple-50"
                        >
                          <Bot className="h-4 w-4 text-purple-600" />
                          <span className="font-medium">{agent.name}</span>
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            orchestrator
                          </span>
                        </button>
                      ))}
                  </>
                )}
                {/* Managers */}
                {agents?.some((a) => a.hierarchyRole === "manager") && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50">
                      Managers
                    </div>
                    {agents
                      .filter((a) => a.hierarchyRole === "manager")
                      .map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() =>
                            handleAddAgentNode(agent.id, agent.name, agent.hierarchyRole ?? "worker")
                          }
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50"
                        >
                          <Bot className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">{agent.name}</span>
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            manager
                          </span>
                        </button>
                      ))}
                  </>
                )}
                {/* Workers */}
                {agents?.some((a) => !a.hierarchyRole || a.hierarchyRole === "worker") && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50">
                      Workers
                    </div>
                    {agents
                      .filter((a) => !a.hierarchyRole || a.hierarchyRole === "worker")
                      .map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() =>
                            handleAddAgentNode(agent.id, agent.name, agent.hierarchyRole ?? "worker")
                          }
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-emerald-50"
                        >
                          <Bot className="h-4 w-4 text-emerald-600" />
                          <span className="font-medium">{agent.name}</span>
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            worker
                          </span>
                        </button>
                      ))}
                  </>
                )}
                {(!agents || agents.length === 0) && (
                  <p className="px-3 py-2 text-xs text-gray-400">No agents available</p>
                )}
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={handleAddOutputNode}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <LogOut className="h-4 w-4 text-rose-500" />
                  Add Output Node
                </button>
                <button
                  onClick={handleAddConditionNode}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <GitBranch className="h-4 w-4 text-amber-500" />
                  Add Condition Node
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={handleAddMemoryNode}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Brain className="h-4 w-4 text-purple-500" />
                  Add Memory Node
                </button>
                <button
                  onClick={handleAddKnowledgeNode}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <BookOpen className="h-4 w-4 text-teal-500" />
                  Add Knowledge Node
                </button>
                <button
                  onClick={handleAddVariableSetNode}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="h-4 w-4 text-cyan-500" />
                  Add Variable Node
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={handleAddDelayNode}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Zap className="h-4 w-4 text-amber-500" />
                  Add Delay Node
                </button>
                <button
                  onClick={handleAddLoopNode}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <RotateCcw className="h-4 w-4 text-indigo-500" />
                  Add Loop Node
                </button>
                <button
                  onClick={handleAddParallelNode}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Play className="h-4 w-4 text-pink-500" />
                  Add Parallel Node
                </button>
                <button
                  onClick={handleAddTeamNode}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Users className="h-4 w-4 text-violet-500" />
                  Add Team Node
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={handleAddHumanGatewayNode}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Shield className="h-4 w-4 text-orange-500" />
                  Add Human Gateway
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => { setShowRunModal(true); setShowAddNode(false); }}
            disabled={nodes.length === 0}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <Play className="h-4 w-4 text-green-600" />
            Run
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saveStatus === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </button>
        </div>
      </div>

      {/* ReactFlow Canvas */}
      <div ref={reactFlowWrapper} className="relative flex-1">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_event, node) => { setSelectedNode(node); setSelectedEdge(null); }}
            onEdgeClick={(_event, edge) => { setSelectedEdge(edge); setSelectedNode(null); setShowAddNode(false); }}
            onPaneClick={() => { setSelectedNode(null); setSelectedEdge(null); setShowAddNode(false); }}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
            deleteKeyCode={null}
          >
            <Background color="#cbd5e1" gap={20} size={1} />
            <Controls />

            {(selectedNode || selectedEdge) && (
              <Panel position="top-right" className="m-4" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <div className="w-56 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                  {selectedNode && (
                    <>
                      <h3 className="text-sm font-semibold text-gray-900">
                        {selectedNode.data?.label ?? "Node"}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">Type: {selectedNode.type}</p>
                      {/* Agent node details */}
                      {selectedNode.type === "agent" && (
                        <div className="mt-2 space-y-1.5">
                          {selectedNode.data?.role && (
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              selectedNode.data.role === "orchestrator" ? "bg-purple-100 text-purple-700" :
                              selectedNode.data.role === "manager" ? "bg-blue-100 text-blue-700" :
                              "bg-emerald-100 text-emerald-700"
                            }`}>
                              {selectedNode.data.role as string}
                            </span>
                          )}
                          {selectedNode.data?.functionName && (
                            <div className="text-xs font-medium text-gray-700">
                              {selectedNode.data.functionName as string}
                            </div>
                          )}
                          {selectedNode.data?.skills && (selectedNode.data.skills as string[]).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {(selectedNode.data.skills as string[]).map((skill: string) => (
                                <span key={skill} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedNode.type === "input" && (
                          <button
                            onClick={() => setShowInputConfig(true)}
                            className="rounded-md bg-green-50 px-3 py-1.5 text-xs font-medium text-green-600 transition-colors hover:bg-green-100"
                          >
                            Configure Input
                          </button>
                        )}
                        {selectedNode.type === "output" && (
                          <button
                            onClick={() => setShowOutputConfig(true)}
                            className="rounded-md bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-100"
                          >
                            Configure Output
                          </button>
                        )}
                        {selectedNode.type === "trigger" && (
                          <button
                            onClick={() => setShowTriggerConfig(true)}
                            className="rounded-md bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-100"
                          >
                            Configure Trigger
                          </button>
                        )}
                        {selectedNode.type === "condition" && (
                          <button
                            onClick={() => setShowConditionConfig(true)}
                            className="rounded-md bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-100"
                          >
                            Configure Condition
                          </button>
                        )}
                        {selectedNode.type === "human-gateway" && (
                          <button
                            onClick={() => setShowHumanGatewayConfig(true)}
                            className="rounded-md bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-600 transition-colors hover:bg-orange-100"
                          >
                            Configure Human Gateway
                          </button>
                        )}
                        <button
                          onClick={handleDeleteNode}
                          className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                        >
                          Delete Node
                        </button>
                      </div>
                      {selectedNode.type === "memory" && (
                        <div className="mt-2 space-y-2">
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Memory Key</label>
                          <input
                            type="text"
                            value={(selectedNode.data?.memoryKey as string) || ""}
                            onChange={(e) => {
                              setNodes((prev) => prev.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, memoryKey: e.target.value } } : n));
                            }}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                          />
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Category</label>
                          <input
                            type="text"
                            value={(selectedNode.data?.memoryCategory as string) || ""}
                            onChange={(e) => {
                              setNodes((prev) => prev.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, memoryCategory: e.target.value } } : n));
                            }}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                          />
                        </div>
                      )}
                      {selectedNode.type === "knowledge" && (
                        <div className="mt-2 space-y-2">
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Top K Results</label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={(selectedNode.data?.topK as number) ?? 5}
                            onChange={(e) => {
                              setNodes((prev) => prev.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, topK: Number(e.target.value) } } : n));
                            }}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                          />
                          <label className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={(selectedNode.data?.useFallback as boolean) ?? true}
                              onChange={(e) => {
                                setNodes((prev) => prev.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, useFallback: e.target.checked } } : n));
                              }}
                              className="rounded border-gray-300"
                            />
                            Fallback to full-text search
                          </label>
                        </div>
                      )}
                      {selectedNode.type === "variable-set" && (
                        <div className="mt-2 space-y-2">
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Variable Name</label>
                          <input
                            type="text"
                            value={(selectedNode.data?.varName as string) || ""}
                            onChange={(e) => {
                              setNodes((prev) => prev.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, varName: e.target.value } } : n));
                            }}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                          />
                        </div>
                      )}
                      {selectedNode.type === "delay" && (
                        <div className="mt-2 space-y-2">
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Delay (ms)</label>
                          <input
                            type="number"
                            value={(selectedNode.data?.delayMs as number) || 1000}
                            onChange={(e) => {
                              setNodes((prev) => prev.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, delayMs: Number(e.target.value) } } : n));
                            }}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                          />
                        </div>
                      )}
                      {selectedNode.type === "loop" && (
                        <div className="mt-2 space-y-2">
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Max Iterations</label>
                          <input
                            type="number"
                            value={(selectedNode.data?.maxIterations as number) || 3}
                            onChange={(e) => {
                              setNodes((prev) => prev.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, maxIterations: Number(e.target.value) } } : n));
                            }}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                          />
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Continue Condition</label>
                          <input
                            type="text"
                            value={(selectedNode.data?.loopCondition as string) || ""}
                            onChange={(e) => {
                              setNodes((prev) => prev.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, loopCondition: e.target.value } } : n));
                            }}
                            placeholder="contains:retry"
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                          />
                        </div>
                      )}
                      {selectedNode.type === "human-gateway" && (
                        <div className="mt-2 space-y-2">
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Approval Prompt</label>
                          <textarea
                            rows={2}
                            value={(selectedNode.data?.approvalPrompt as string) || ""}
                            onChange={(e) => {
                              setNodes((prev) => prev.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, approvalPrompt: e.target.value } } : n));
                            }}
                            placeholder="What should the reviewer check?"
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                          />
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Timeout (minutes)</label>
                          <input
                            type="number"
                            min={0}
                            value={(selectedNode.data?.timeoutMinutes as number) || 0}
                            onChange={(e) => {
                              setNodes((prev) => prev.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, timeoutMinutes: Number(e.target.value) } } : n));
                            }}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                          />
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Timeout Action</label>
                          <select
                            value={(selectedNode.data?.timeoutAction as string) || "approve"}
                            onChange={(e) => {
                              setNodes((prev) => prev.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, timeoutAction: e.target.value } } : n));
                            }}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                          >
                            <option value="approve">Auto-Approve</option>
                            <option value="reject">Auto-Reject</option>
                          </select>
                          <p className="text-[10px] text-gray-400">
                            Set to 0 for no timeout. Connect the bottom handle to an error path for rejections.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  {selectedEdge && (
                    <>
                      <h3 className="text-sm font-semibold text-gray-900">Connection</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {selectedEdge.source} → {selectedEdge.target}
                      </p>
                      <div className="mt-3 space-y-2">
                        <label className="text-[10px] font-medium text-gray-500 uppercase">Condition</label>
                        <input
                          type="text"
                          value={(selectedEdge.label as string) || ""}
                          onChange={(e) => {
                            setEdges((prev) =>
                              prev.map((edge) =>
                                edge.id === selectedEdge.id
                                  ? { ...edge, label: e.target.value || undefined }
                                  : edge
                              )
                            );
                          }}
                          placeholder="contains:yes, error:, loop:, regex:..."
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                        />
                        <p className="text-[10px] text-gray-400">
                          Prefix with <code className="bg-gray-100 px-1 rounded">error:</code> for error routing,{" "}
                          <code className="bg-gray-100 px-1 rounded">loop:</code> for loop-back, or{" "}
                          <code className="bg-gray-100 px-1 rounded">contains:word</code> to filter.
                        </p>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={handleDeleteEdge}
                          className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                        >
                          Delete Connection
                        </button>
                      </div>
                      <p className="mt-2 text-[10px] text-gray-400">Tip: Press Delete key to remove selected connections</p>
                    </>
                  )}
                </div>
              </Panel>
            )}
          </ReactFlow>
        )}
      </div>

      {/* Run Workflow Modal */}
      {showRunModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Run Workflow</h3>
              <button
                onClick={() => setShowRunModal(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-sm text-gray-500">
              Enter a message to send through the workflow. It will start at Input/Trigger nodes and flow through connected agents.
            </p>
            <textarea
              value={runInput}
              onChange={(e) => setRunInput(e.target.value)}
              placeholder="Enter your message..."
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowRunModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRun}
                disabled={!runInput.trim() || runMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {runMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Play className="h-4 w-4" />
                Run Workflow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Panel */}
      {showResults && (
        <div className="absolute bottom-4 right-4 z-40 w-96 max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-blue-600" />
              Workflow Results
            </h3>
            <button
              onClick={() => setShowResults(false)}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {runResults && runResults.length > 0 ? (
            <div className="space-y-3">
              {runResults.map((output, i) => (
                <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">
                      {output.agentName ?? `Node ${output.nodeId}`}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{output.response}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No outputs produced.</p>
          )}
        </div>
      )}

      {/* Input Config Modal */}
      <InputConfigModal
        isOpen={showInputConfig}
        onClose={() => setShowInputConfig(false)}
        initialConfig={
          selectedNode?.type === "input"
            ? {
                inputType: (selectedNode.data?.inputType as string) || "telegram",
                botToken: (selectedNode.data?.botToken as string) || "",
                sourceName: (selectedNode.data?.label as string) || "",
              }
            : null
        }
        onSave={(config) => {
          if (selectedNode) {
            const updatedData = { ...selectedNode.data, inputType: config.inputType, botToken: config.botToken, label: config.sourceName || selectedNode.data?.label };
            setNodes((prev) =>
              prev.map((n) =>
                n.id === selectedNode.id
                  ? { ...n, data: updatedData }
                  : n
              )
            );
            setSelectedNode({ ...selectedNode, data: updatedData });
            flowStore.updateNode(selectedNode.id, {
              data: {
                ...(selectedNode.data as Record<string, unknown>),
                inputType: config.inputType,
                botToken: config.botToken,
                label: config.sourceName || selectedNode.data?.label,
              },
            });
          }
        }}
        onSetWebhook={async (botToken: string) => {
          await utils.client.execution.setTelegramWebhook.mutate({ stackId, botToken });
        }}
      />

      {/* Output Config Modal */}
      <OutputConfigModal
        isOpen={showOutputConfig}
        onClose={() => setShowOutputConfig(false)}
        initialConfig={
          selectedNode?.type === "output"
            ? {
                outputType: (selectedNode.data?.outputType as string) || "webhook",
                ...((selectedNode.data?.config as Record<string, string>) || {}),
              }
            : null
        }
        onSave={(config) => {
          if (selectedNode) {
            const updatedData = { ...selectedNode.data, outputType: config.outputType, config: { ...config } };
            setNodes((prev) =>
              prev.map((n) =>
                n.id === selectedNode.id
                  ? { ...n, data: updatedData }
                  : n
              )
            );
            setSelectedNode({ ...selectedNode, data: updatedData });
            flowStore.updateNode(selectedNode.id, {
              data: {
                ...(selectedNode.data as Record<string, unknown>),
                outputType: config.outputType,
                config: { ...config },
              },
            });
          }
        }}
      />

      {/* Trigger Config Modal */}
      <TriggerConfigModal
        isOpen={showTriggerConfig}
        onClose={() => setShowTriggerConfig(false)}
        initialConfig={
          selectedNode?.type === "trigger"
            ? {
                triggerType: (selectedNode.data?.triggerType as string) || "manual",
                sourceName: (selectedNode.data?.label as string) || "",
                cronExpression: (selectedNode.data?.cronExpression as string) || "",
                webhookUrl: (selectedNode.data?.webhookUrl as string) || "",
              }
            : null
        }
        onSave={(config) => {
          if (selectedNode) {
            const updatedData = { ...selectedNode.data, triggerType: config.triggerType, label: config.sourceName || selectedNode.data?.label, cronExpression: config.cronExpression, webhookUrl: config.webhookUrl };
            setNodes((prev) =>
              prev.map((n) =>
                n.id === selectedNode.id
                  ? { ...n, data: updatedData }
                  : n
              )
            );
            setSelectedNode({ ...selectedNode, data: updatedData });
            flowStore.updateNode(selectedNode.id, {
              data: {
                ...(selectedNode.data as Record<string, unknown>),
                triggerType: config.triggerType,
                label: config.sourceName || selectedNode.data?.label,
                cronExpression: config.cronExpression,
                webhookUrl: config.webhookUrl,
              },
            });
          }
        }}
      />

      {/* Condition Config Modal */}
      <ConditionConfigModal
        isOpen={showConditionConfig}
        onClose={() => setShowConditionConfig(false)}
        initialConfig={
          selectedNode?.type === "condition"
            ? {
                label: (selectedNode.data?.label as string) || "Condition",
                operator: (selectedNode.data?.operator as string) || "contains",
                value: (selectedNode.data?.value as string) || "",
              }
            : null
        }
        onSave={(config) => {
          if (selectedNode) {
            const updatedData = { ...selectedNode.data, label: config.label, operator: config.operator, value: config.value };
            setNodes((prev) =>
              prev.map((n) =>
                n.id === selectedNode.id
                  ? { ...n, data: updatedData }
                  : n
              )
            );
            setSelectedNode({ ...selectedNode, data: updatedData });
            flowStore.updateNode(selectedNode.id, {
              data: {
                ...(selectedNode.data as Record<string, unknown>),
                label: config.label,
                operator: config.operator,
                value: config.value,
              },
            });
          }
        }}
      />

      {/* Human Gateway Config Modal */}
      <HumanGatewayConfigModal
        isOpen={showHumanGatewayConfig}
        onClose={() => setShowHumanGatewayConfig(false)}
        initialConfig={
          selectedNode?.type === "human-gateway"
            ? {
                label: (selectedNode.data?.label as string) || "",
                approvalPrompt: (selectedNode.data?.approvalPrompt as string) || "",
                timeoutMinutes: (selectedNode.data?.timeoutMinutes as number) ?? 0,
                timeoutAction: (selectedNode.data?.timeoutAction as string) || "approve",
              }
            : null
        }
        onSave={(config) => {
          if (selectedNode) {
            const updatedData = { ...selectedNode.data, ...config };
            setNodes((prev) =>
              prev.map((n) =>
                n.id === selectedNode.id
                  ? { ...n, data: updatedData }
                  : n
              )
            );
            setSelectedNode({ ...selectedNode, data: updatedData });
            flowStore.updateNode(selectedNode.id, {
              data: {
                ...(selectedNode.data as Record<string, unknown>),
                ...config,
              },
            });
          }
        }}
      />

      {/* Agent Edit Modal */}
      {editingAgentId && (
        <AgentEditModal
          stackId={stackId}
          agentId={editingAgentId}
          onClose={() => setEditingAgentId(null)}
          onSaved={() => {
            utils.agent.list.invalidate({ stackId });
            setEditingAgentId(null);
          }}
        />
      )}
    </div>
  );
}

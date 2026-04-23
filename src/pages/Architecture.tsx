import { useState, useCallback, useEffect } from "react";
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
} from "lucide-react";
import { trpc } from "@/trpc";
import { useStack } from "@/components/layout/StackLayout";
import { useFlowStore } from "@/stores/flowStore";

// ─── Custom Node Components ───

function AgentNode({ data }: { data: { label: string; role?: string } }) {
  const roleColors: Record<string, string> = {
    orchestrator: "border-purple-400 bg-purple-50",
    manager: "border-blue-400 bg-blue-50",
    worker: "border-gray-300 bg-white",
  };
  return (
    <div
      className={`min-w-[140px] rounded-lg border-2 p-3 shadow-sm ${
        roleColors[data.role ?? "worker"]
      }`}
    >
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-900">{data.label}</span>
      </div>
      {data.role && (
        <span className="mt-1 inline-block rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
          {data.role}
        </span>
      )}
    </div>
  );
}

function TriggerNode({ data }: { data: { label: string } }) {
  return (
    <div className="min-w-[120px] rounded-lg border-2 border-amber-400 bg-amber-50 p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-medium text-gray-900">{data.label}</span>
      </div>
    </div>
  );
}

const nodeTypes = {
  agent: AgentNode,
  trigger: TriggerNode,
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
  const [showAddNode, setShowAddNode] = useState(false);

  const { data: workflowData, isLoading } = trpc.workflow.load.useQuery({ stackId });
  const { data: agents } = trpc.agent.list.useQuery({ stackId });

  const saveMutation = trpc.workflow.save.useMutation({
    onSuccess: () => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      utils.workflow.load.invalidate({ stackId });
    },
    onError: () => {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
  });

  // Load workflow data into canvas and flow store
  useEffect(() => {
    if (workflowData) {
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
          type: n.type === "agent" ? "agent" : n.type === "trigger" ? "trigger" : "default",
          position: {
            x: n.positionX ?? Math.random() * 400,
            y: n.positionY ?? Math.random() * 300,
          },
          data: n.data ?? { label: `Node ${n.id}` },
        })) ?? [];

      const loadedEdges: Edge[] =
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

      setNodes(loadedNodes);
      setEdges(loadedEdges);
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
    }
  }, [workflowData, setNodes, setEdges, flowStore]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const handleSave = () => {
    setSaveStatus("saving");
    saveMutation.mutate({
      stackId,
      nodes: nodes.map((n) => ({
        id: parseInt(n.id, 10) || nextNodeIdCounter++,
        agentId: n.type === "agent" ? (n.data?.agentId as number | undefined) : undefined,
        type: n.type === "trigger" ? "trigger" : "agent",
        positionX: Math.round(n.position.x),
        positionY: Math.round(n.position.y),
        data: n.data,
      })),
      edges: edges.map((e) => ({
        id: parseInt(e.id, 10) || nextNodeIdCounter++,
        sourceId: parseInt(e.source, 10),
        targetId: parseInt(e.target, 10),
        condition: e.label ?? undefined,
      })),
    });
  };

  const handleReset = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    nextNodeIdCounter = 1;
    flowStore.reset();
  };

  const handleAddAgentNode = (agentId: number, agentName: string, role: string) => {
    const newNode: Node = {
      id: `node-${nextNodeIdCounter++}`,
      type: "agent",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 150 },
      data: { label: agentName, role, agentId },
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
      data: { label: "New Trigger" },
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

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col -m-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-gray-900">Workflow Architecture</h1>
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
              <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={handleAddTriggerNode}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Zap className="h-4 w-4 text-amber-500" />
                  Add Trigger Node
                </button>
                <div className="my-1 border-t border-gray-100" />
                {agents?.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() =>
                      handleAddAgentNode(agent.id, agent.name, agent.hierarchyRole ?? "worker")
                    }
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Bot className="h-4 w-4 text-purple-500" />
                    {agent.name}
                  </button>
                ))}
                {(!agents || agents.length === 0) && (
                  <p className="px-3 py-2 text-xs text-gray-400">No agents available</p>
                )}
              </div>
            )}
          </div>
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
      <div className="relative flex-1">
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
            onNodeClick={(_event, node) => setSelectedNode(node)}
            onPaneClick={() => { setSelectedNode(null); setShowAddNode(false); }}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
          >
            <Background color="#cbd5e1" gap={20} size={1} />
            <Controls />

            {selectedNode && (
              <Panel position="top-right" className="m-4">
                <div className="w-56 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {selectedNode.data?.label ?? "Node"}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">Type: {selectedNode.type}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleDeleteNode}
                      className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                    >
                      Delete Node
                    </button>
                  </div>
                </div>
              </Panel>
            )}
          </ReactFlow>
        )}
      </div>
    </div>
  );
}

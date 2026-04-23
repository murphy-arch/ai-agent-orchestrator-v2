import { create } from "zustand";

export interface AgentNodeData {
  name?: string;
  hierarchyRole?: string;
  connectedModel?: string;
  modelName?: string;
  isEnabled?: boolean;
  hasCredentials?: boolean;
  [key: string]: unknown;
}

export interface InputNodeData {
  inputType?: string;
  label?: string;
  isActive?: boolean;
  [key: string]: unknown;
}

interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface FlowStore {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNode: string | null;
  setNodes: (nodes: FlowNode[]) => void;
  setEdges: (edges: FlowEdge[]) => void;
  addNode: (node: FlowNode) => void;
  updateNode: (id: string, data: Partial<FlowNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: FlowEdge) => void;
  removeEdge: (id: string) => void;
  setSelectedNode: (id: string | null) => void;
  loadFromDb: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  reset: () => void;
}

export const useFlowStore = create<FlowStore>((set) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
  updateNode: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...data } : n)),
    })),
  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
    })),
  addEdge: (edge) => set((s) => ({ edges: [...s.edges, edge] })),
  removeEdge: (id) =>
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),
  setSelectedNode: (id) => set({ selectedNode: id }),
  loadFromDb: (nodes, edges) => set({ nodes, edges }),
  reset: () => set({ nodes: [], edges: [], selectedNode: null }),
}));

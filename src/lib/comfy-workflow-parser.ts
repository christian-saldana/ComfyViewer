import dagre from "dagre";
import { Edge, Node } from "reactflow";

// ComfyUI workflow JSON type (simplified)
interface ComfyUINode {
  id: string;
  class_type: string;
  inputs: Record<string, unknown>;
}

export interface ComfyUIWorkflow {
  [key: string]: ComfyUINode;
}

export interface ParsedWorkflow {
  nodes: Node[];
  edges: Edge[];
}

// Utility to parse ComfyUI workflow JSON into React Flow nodes/edges
export function parseComfyWorkflow(
  workflow: ComfyUIWorkflow
): ParsedWorkflow {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const edgeIds = new Set<string>(); // To avoid duplicates
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR" }); // Left-to-right layout
  g.setDefaultEdgeLabel(() => ({}));

  // 1. Create nodes
  Object.entries(workflow).forEach(([id, node]) => {
    const label =
      typeof node === "object" && node && "class_type" in node
        ? node.class_type
        : id;
    nodes.push({
      id,
      data: node, // Pass the full node object as data for ComfyNode rendering
      position: { x: 0, y: 0 }, // To be set by dagre
      type: "comfy",
    });
    g.setNode(id, { label, width: 320, height: 140 }); // increase node size
  });

  // 2. Create edges (based on inputs that reference other node ids)
  Object.entries(workflow).forEach(([id, node]) => {
    Object.values(node.inputs || {}).forEach((input) => {
      // ComfyUI refs: [nodeId, outputIndex] or direct nodeId string
      if (Array.isArray(input) && typeof input[0] === "string") {
        const edgeId = `${input[0]}-${id}`;
        if (!edgeIds.has(edgeId)) {
          edges.push({
            id: edgeId,
            source: input[0],
            target: id,
            animated: true,
            style: { strokeWidth: 2 },
          });
          edgeIds.add(edgeId);
          g.setEdge(input[0], id);
        }
      } else if (typeof input === "string" && workflow[input]) {
        const edgeId = `${input}-${id}`;
        if (!edgeIds.has(edgeId)) {
          edges.push({
            id: edgeId,
            source: input,
            target: id,
            animated: true,
            style: { strokeWidth: 2 },
          });
          edgeIds.add(edgeId);
          g.setEdge(input, id);
        }
      }
    });
  });

  // 3. Auto-layout with dagre
  dagre.layout(g);
  nodes.forEach((node) => {
    const pos = g.node(node.id);
    if (pos) {
      node.position = { x: pos.x - 160, y: pos.y - 70 };
    }
  });

  return { nodes, edges };
}
"use client";

import * as React from "react";

import { Expand, ZoomIn, ZoomOut } from "lucide-react";
import { useTheme } from "next-themes";
import ReactFlow, {
  Background,
  ConnectionLineType,
  Edge,
  Node,
  Panel,
  ReactFlowInstance,
  applyEdgeChanges,
  applyNodeChanges,
  EdgeChange,
  NodeChange,
} from "reactflow";

import "reactflow/dist/style.css";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ComfyUIWorkflow, parseComfyWorkflow } from "@/lib/comfy-workflow-parser";

import ComfyNode from "./comfy-node";

interface WorkflowViewerProps {
  workflowJson: Record<string, unknown> | null;
}

export function WorkflowViewer({ workflowJson }: WorkflowViewerProps) {
  const [nodes, setNodes] = React.useState<Node[]>([]);
  const [edges, setEdges] = React.useState<Edge[]>([]);
  const [reactFlowInstance, setReactFlowInstance] =
    React.useState<ReactFlowInstance | null>(null);
  const { theme } = useTheme();
  React.useEffect(() => {
    if (!workflowJson) {
      setNodes([]);
      setEdges([]);
      return;
    }
    try {
      if (
        typeof workflowJson === "object" &&
        workflowJson !== null &&
        Object.values(workflowJson).some(
          (v) => v && typeof v === "object" && "class_type" in v
        )
      ) {
        const workflowNodes = Object.entries(workflowJson)
          .filter(
            ([k, v]) =>
              !isNaN(Number(k)) &&
              v &&
              typeof v === "object" &&
              "class_type" in v
          )
          .map(([k, v]) => [k, v]);
        const workflowObj = Object.fromEntries(workflowNodes);
        const { nodes: dagreNodes, edges: dagreEdges } = parseComfyWorkflow(
          workflowObj as unknown as ComfyUIWorkflow
        );
        dagreNodes.forEach((n) => (n.type = "comfy"));
        setNodes(dagreNodes);
        setEdges(dagreEdges);
      } else {
        setNodes([]);
        setEdges([]);
      }
    } catch {
      setNodes([]);
      setEdges([]);
    }
  }, [workflowJson]);

  const nodeTypes = React.useMemo(() => ({ comfy: ComfyNode }), []);

  const onNodesChange = React.useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange = React.useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  const handleFitView = () => reactFlowInstance?.fitView({ padding: 0.2 });
  const handleZoomIn = () => reactFlowInstance?.zoomIn();
  const handleZoomOut = () => reactFlowInstance?.zoomOut();

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={setReactFlowInstance}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        connectionLineType={ConnectionLineType.SmoothStep}
        className={theme}
      >
        <Background />
        <Panel position="top-right">
          <TooltipProvider>
            <div className="flex space-x-2 rounded-md border bg-background p-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleZoomIn}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom In</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleZoomOut}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom Out</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleFitView}>
                    <Expand className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Fit View</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </Panel>
      </ReactFlow>
    </div>
  );
}
"use client";

import * as React from "react";

import { Handle, Position, NodeProps } from "reactflow";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const ComfyNode: React.FC<NodeProps> = ({ data, isConnectable }) => {
  const { class_type, inputs } = data;

  return (
    <Card className={cn("w-80 border-2 shadow-md")}>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="!bg-primary"
      />
      <CardHeader className="p-3">
        <CardTitle className="text-sm">{class_type}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <ScrollArea className="h-20 w-full">
          <div className="space-y-1 text-xs">
            {Object.entries(inputs).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground">{key}:</span>
                <span className="truncate pl-2 text-right">
                  {Array.isArray(value)
                    ? `[${value[0]}, ${value[1]}]`
                    : String(value)}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="!bg-primary"
      />
    </Card>
  );
};

export default ComfyNode;
"use client";

import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Info, Maximize } from "lucide-react";
import { getMetadata } from "meta-png";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface MetadataViewerProps {
  image: File | null;
}

interface ComfyMetadata {
  prompt: string;
  negativePrompt: string;
  seed: number | string;
  cfg: number | string;
  steps: number | string;
  sampler: string;
  scheduler: string;
  fullWorkflow: object;
}

// A simple component to display a metadata item
const MetadataItem = ({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) => (
  <li>
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
    <p className={cn("break-words text-sm", valueClassName)}>{value}</p>
  </li>
);

export function MetadataViewer({ image }: MetadataViewerProps) {
  const [comfyMetadata, setComfyMetadata] =
    React.useState<ComfyMetadata | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isWorkflowFullscreen, setIsWorkflowFullscreen] = React.useState(false);

  React.useEffect(() => {
    // Reset state when image changes
    setComfyMetadata(null);
    setError(null);
    setIsLoading(false);

    if (!image) {
      return;
    }

    // We only support PNG for ComfyUI metadata
    if (image.type !== "image/png") {
      setComfyMetadata(null);
      return;
    }

    const parseMetadata = async () => {
      setIsLoading(true);
      setError(null);

      // Helper to resolve a value, which might be a direct value or a link to another node's input.
      const resolveValue = (workflow: any, input: any): any => {
        if (!Array.isArray(input) || typeof input[0] !== 'string' || !workflow[input[0]]) {
          return input; // It's a direct value
        }
        const sourceNode = workflow[input[0]];
        if (sourceNode && sourceNode.inputs) {
          // Common primitive node input names
          if (sourceNode.inputs.value !== undefined) return sourceNode.inputs.value;
          if (sourceNode.inputs._int !== undefined) return sourceNode.inputs._int;
          if (sourceNode.inputs.float !== undefined) return sourceNode.inputs.float;
          if (sourceNode.inputs.sampler_name !== undefined) return sourceNode.inputs.sampler_name;
        }
        return "N/A";
      };

      // Helper to trace back through links to find the ultimate text prompt.
      const findPromptText = (workflow: any, startLink: any): string => {
        let currentLink = startLink;
        for (let i = 0; i < 10; i++) { // Safety break for circular dependencies
          if (typeof currentLink === 'string') return currentLink;
          if (!Array.isArray(currentLink) || typeof currentLink[0] !== 'string' || !workflow[currentLink[0]]) {
            break;
          }
          const sourceNode = workflow[currentLink[0]];
          if (!sourceNode || !sourceNode.inputs) break;
          
          // Found the text, return it
          if (typeof sourceNode.inputs.text === 'string') return sourceNode.inputs.text;
          // Some custom nodes use 'string'
          if (typeof sourceNode.inputs.string === 'string') return sourceNode.inputs.string;

          // Follow the link to the next node
          currentLink = sourceNode.inputs.text || sourceNode.inputs.string;
        }
        return "N/A";
      };

      try {
        const buffer = await image.arrayBuffer();
        const pngBytes = new Uint8Array(buffer);
        const promptText = getMetadata(pngBytes, "prompt");

        if (!promptText) {
          setComfyMetadata(null); // No metadata, but not an error.
          return;
        }

        const jsonStart = promptText.indexOf("{");
        const jsonEnd = promptText.lastIndexOf("}");
        if (jsonStart === -1 || jsonEnd === -1) {
          setError("Could not find a valid JSON workflow in the metadata.");
          return;
        }

        let jsonString = promptText.substring(jsonStart, jsonEnd + 1).replace(/NaN/g, "null");
        const workflow = JSON.parse(jsonString);

        const ksamplerNodeEntry = Object.entries(workflow).find(
          ([, node]: [string, any]) =>
            ["KSampler", "KSamplerAdvanced", "SharkSampler_Beta"].includes(node.class_type)
        );

        if (!ksamplerNodeEntry) {
          // Can't find a sampler, but we can still show the full workflow JSON.
          setComfyMetadata({
            prompt: "N/A", negativePrompt: "N/A", seed: "N/A", cfg: "N/A",
            steps: "N/A", sampler: "N/A", scheduler: "N/A", fullWorkflow: workflow,
          });
          return;
        }

        const ksamplerNode = ksamplerNodeEntry[1] as any;
        const inputs = ksamplerNode.inputs;

        let prompt = findPromptText(workflow, inputs.positive);
        let negativePrompt = findPromptText(workflow, inputs.negative);

        // Fallback to searching by title if tracing fails
        if (prompt === "N/A") {
          const positivePromptNode = Object.values(workflow).find(
            (node: any) => node._meta?.title?.toLowerCase().includes("positive prompt")
          ) as any;
          if (positivePromptNode?.inputs?.text) {
            prompt = findPromptText(workflow, positivePromptNode.inputs.text);
          }
        }
        if (negativePrompt === "N/A") {
          const negativePromptNode = Object.values(workflow).find(
            (node: any) => node._meta?.title?.toLowerCase().includes("negative prompt")
          ) as any;
          if (negativePromptNode?.inputs?.text) {
            negativePrompt = findPromptText(workflow, negativePromptNode.inputs.text);
          }
        }

        const parsedData: ComfyMetadata = {
          prompt: prompt,
          negativePrompt: negativePrompt,
          seed: resolveValue(workflow, inputs.seed) ?? "N/A",
          cfg: resolveValue(workflow, inputs.cfg) ?? "N/A",
          steps: resolveValue(workflow, inputs.steps) ?? "N/A",
          sampler: resolveValue(workflow, inputs.sampler_name || inputs.sampler) ?? "N/A",
          scheduler: resolveValue(workflow, inputs.scheduler) ?? "N/A",
          fullWorkflow: workflow,
        };

        setComfyMetadata(parsedData);

      } catch (e) {
        console.error("Failed to parse metadata:", e);
        setError("Failed to read or parse workflow. It might be malformed.");
      } finally {
        setIsLoading(false);
      }
    };

    parseMetadata();
  }, [image]);

  if (!image) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Metadata</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-4 text-center text-muted-foreground">
          <Info className="h-12 w-12" />
          <h2 className="mt-4 text-lg font-semibold">No Image Selected</h2>
          <p className="mt-1 text-sm">Select an image to view its details.</p>
        </div>
      </div>
    );
  }

  const basicMetadata = [
    { label: "File Name", value: image.name },
    { label: "File Size", value: `${(image.size / 1024).toFixed(2)} KB` },
    { label: "File Type", value: image.type },
    {
      label: "Last Modified",
      value: new Date(image.lastModified).toLocaleString(),
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-lg font-semibold">Metadata</h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          <h3 className="mb-2 text-base font-semibold">File Details</h3>
          <ul className="space-y-3">
            {basicMetadata.map((item) => (
              <MetadataItem
                key={item.label}
                label={item.label}
                value={item.value}
              />
            ))}
          </ul>
        </div>

        {image.type === "image/png" && (
          <>
            <Separator />
            <div className="p-4">
              <h3 className="mb-2 text-base font-semibold">
                Generator Metadata
              </h3>
              {isLoading && (
                <div className="space-y-4">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-10 w-full" />
                </div>
              )}
              {error && !isLoading && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              {comfyMetadata && !isLoading && (
                <>
                  <ul className="space-y-3">
                    <MetadataItem
                      label="Prompt"
                      value={comfyMetadata.prompt}
                      valueClassName="leading-relaxed"
                    />
                    <MetadataItem
                      label="Negative Prompt"
                      value={comfyMetadata.negativePrompt}
                      valueClassName="leading-relaxed"
                    />
                    <MetadataItem label="Seed" value={String(comfyMetadata.seed)} />
                    <MetadataItem
                      label="CFG Scale"
                      value={String(comfyMetadata.cfg)}
                    />
                    <MetadataItem label="Steps" value={String(comfyMetadata.steps)} />
                    <MetadataItem
                      label="Sampler"
                      value={comfyMetadata.sampler}
                    />
                    <MetadataItem
                      label="Scheduler"
                      value={comfyMetadata.scheduler}
                    />
                  </ul>
                  <Accordion type="single" collapsible className="w-full pt-4">
                    <AccordionItem value="item-1">
                      <div className="flex items-center justify-between">
                        <AccordionTrigger className="flex-1">
                          Full Workflow (JSON)
                        </AccordionTrigger>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsWorkflowFullscreen(true);
                          }}
                        >
                          <Maximize className="h-4 w-4" />
                        </Button>
                      </div>
                      <AccordionContent>
                        <ScrollArea className="h-64 w-full resize-y overflow-auto rounded-md border bg-muted/50 p-2">
                          <pre className="text-xs whitespace-pre-wrap break-all">
                            {JSON.stringify(
                              comfyMetadata.fullWorkflow,
                              null,
                              2
                            )}
                          </pre>
                        </ScrollArea>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  <Dialog
                    open={isWorkflowFullscreen}
                    onOpenChange={setIsWorkflowFullscreen}
                  >
                    <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                      <DialogHeader>
                        <DialogTitle>Full Workflow (JSON)</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="flex-1 rounded-md border bg-muted/50 p-2">
                        <pre className="text-xs whitespace-pre-wrap break-all">
                          {JSON.stringify(
                            comfyMetadata.fullWorkflow,
                            null,
                            2
                          )}
                        </pre>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </>
              )}
               {!comfyMetadata && !isLoading && !error && (
                <p className="text-sm text-muted-foreground">No generator metadata found in this image.</p>
              )}
            </div>
          </>
        )}
      </ScrollArea>
    </div>
  );
}
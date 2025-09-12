"use client";

import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Info } from "lucide-react";
import { getMetadata } from "meta-png";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface MetadataViewerProps {
  image: File | null;
}

interface ComfyMetadata {
  prompt: string;
  negativePrompt: string;
  seed: number;
  cfg: number;
  steps: number;
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
      try {
        const buffer = await image.arrayBuffer();
        const pngBytes = new Uint8Array(buffer);
        const promptText = getMetadata(pngBytes, "prompt");

        if (!promptText) {
          setError("No ComfyUI workflow found in this PNG.");
          return;
        }

        // Find the start and end of the JSON object to clean up any extra characters
        const jsonStart = promptText.indexOf("{");
        const jsonEnd = promptText.lastIndexOf("}");

        if (jsonStart === -1 || jsonEnd === -1) {
          setError("Could not find a valid JSON workflow in the metadata.");
          return;
        }

        let jsonString = promptText.substring(jsonStart, jsonEnd + 1);

        // Sanitize the string to replace invalid JSON values like NaN
        jsonString = jsonString.replace(/NaN/g, "null");
        console.log('workflow')
        const workflow = JSON.parse(jsonString);

        const ksamplerNodeEntry = Object.entries(workflow).find(
          ([, node]: [string, any]) =>
            node.class_type === "KSampler" ||
            node.class_type === "KSamplerAdvanced" ||
            node.class_type === "SharkSampler_Beta"
        );

        if (!ksamplerNodeEntry) {
          setError("Could not find a KSampler node in the workflow.");
          return;
        }

        const ksamplerNode = ksamplerNodeEntry[1] as any;
        const inputs = ksamplerNode.inputs;

        // Find prompt nodes, which might be linked or directly embedded
        const positivePromptNode = Object.values(workflow).find(
          (node: any) =>
            node._meta?.title?.toLowerCase().includes("positive prompt")
        ) as any;
        const negativePromptNode = Object.values(workflow).find(
          (node: any) =>
            node._meta?.title?.toLowerCase().includes("negative prompt")
        ) as any;

        if (!positivePromptNode || !negativePromptNode) {
          setError("Could not trace prompts from the workflow.");
          return;
        }

        const parsedData: ComfyMetadata = {
          prompt: positivePromptNode.inputs.text,
          negativePrompt: negativePromptNode.inputs.text,
          seed: inputs.seed?.[0]
            ? workflow[inputs.seed[0]]?.inputs.value
            : inputs.seed,
          cfg: inputs.cfg?.[0]
            ? workflow[inputs.cfg[0]]?.inputs.value
            : inputs.cfg,
          steps: inputs.steps?.[0]
            ? workflow[inputs.steps[0]]?.inputs._int
            : inputs.steps,
          sampler:
            inputs.sampler_name ||
            (inputs.sampler?.[0]
              ? workflow[inputs.sampler[0]]?.inputs.sampler_name
              : "N/A"),
          scheduler: inputs.scheduler,
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
                <p className="text-sm text-muted-foreground">{error}</p>
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
                    <MetadataItem label="Seed" value={comfyMetadata.seed} />
                    <MetadataItem
                      label="CFG Scale"
                      value={comfyMetadata.cfg}
                    />
                    <MetadataItem label="Steps" value={comfyMetadata.steps} />
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
                      <AccordionTrigger>Full Workflow (JSON)</AccordionTrigger>
                      <AccordionContent>
                        <ScrollArea className="h-64 w-full rounded-md border bg-muted/50 p-2">
                          <pre className="text-xs">
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
                </>
              )}
            </div>
          </>
        )}
      </ScrollArea>
    </div>
  );
}
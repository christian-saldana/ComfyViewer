"use client";

import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Info, Maximize } from "lucide-react";
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
import { StoredImage } from "@/lib/image-db";
import { Badge } from "@/components/ui/badge";

interface MetadataViewerProps {
  imageFile: File | null;
  imageMetadata: StoredImage | null;
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

export function MetadataViewer({ imageFile, imageMetadata }: MetadataViewerProps) {
  const [isWorkflowFullscreen, setIsWorkflowFullscreen] = React.useState(false);
  const [fullWorkflow, setFullWorkflow] = React.useState<object | null>(null);

  React.useEffect(() => {
    if (imageMetadata?.workflow) {
      try {
        setFullWorkflow(JSON.parse(imageMetadata.workflow));
      } catch (e) {
        console.error("Failed to parse workflow JSON from DB", e);
        setFullWorkflow(null);
      }
    } else {
      setFullWorkflow(null);
    }
  }, [imageMetadata]);

  if (!imageMetadata) {
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
    { label: "File Name", value: imageMetadata.name },
    { label: "File Size", value: `${(imageMetadata.size / 1024).toFixed(2)} KB` },
    { label: "File Type", value: imageMetadata.type },
    {
      label: "Last Modified",
      value: new Date(imageMetadata.lastModified).toLocaleString(),
    },
  ];

  const hasGeneratorMetadata = imageMetadata.prompt || imageMetadata.seed;

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

        {imageMetadata.type === "image/png" && (
          <>
            <Separator />
            <div className="p-4">
              <h3 className="mb-2 text-base font-semibold">
                Generator Metadata
              </h3>
              {hasGeneratorMetadata ? (
                <>
                  <ul className="space-y-3">
                    {imageMetadata.model && <MetadataItem
                      label="Model"
                      value={imageMetadata.model}
                    />}
                    {imageMetadata.loras && imageMetadata.loras.length > 0 && <MetadataItem
                      label="LoRAs"
                      value={<div className="flex flex-wrap gap-1 pt-1">
                        {imageMetadata.loras.map((lora, i) => <Badge key={`${lora}-${i}`} variant="secondary">{lora}</Badge>)}
                      </div>}
                    />}
                    {imageMetadata.prompt && <MetadataItem
                      label="Prompt"
                      value={imageMetadata.prompt}
                      valueClassName="leading-relaxed"
                    />}
                    {imageMetadata.negativePrompt && <MetadataItem
                      label="Negative Prompt"
                      value={imageMetadata.negativePrompt}
                      valueClassName="leading-relaxed"
                    />}
                    {imageMetadata.seed && <MetadataItem label="Seed" value={String(imageMetadata.seed)} />}
                    {imageMetadata.cfg && <MetadataItem
                      label="CFG Scale"
                      value={String(imageMetadata.cfg)}
                    />}
                    {imageMetadata.steps && <MetadataItem label="Steps" value={String(imageMetadata.steps)} />}
                    {imageMetadata.sampler && <MetadataItem
                      label="Sampler"
                      value={imageMetadata.sampler}
                    />}
                    {imageMetadata.scheduler && <MetadataItem
                      label="Scheduler"
                      value={imageMetadata.scheduler}
                    />}
                  </ul>
                  {fullWorkflow && <Accordion type="single" collapsible className="w-full pt-4">
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
                              fullWorkflow,
                              null,
                              2
                            )}
                          </pre>
                        </ScrollArea>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>}
                  <Dialog
                    open={isWorkflowFullscreen}
                    onOpenChange={setIsWorkflowFullscreen}
                  >
                    <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                      <DialogHeader>
                        <DialogTitle>Full Workflow (JSON)</DialogTitle>
                      </DialogHeader>
                      {fullWorkflow && <ScrollArea className="flex-1 rounded-md border bg-muted/50 p-2">
                        <pre className="text-xs whitespace-pre-wrap break-all">
                          {JSON.stringify(
                            fullWorkflow,
                            null,
                            2
                          )}
                        </pre>
                      </ScrollArea>}
                    </DialogContent>
                  </Dialog>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No generator metadata found in this image.</p>
              )}
            </div>
          </>
        )}
      </ScrollArea>
    </div>
  );
}
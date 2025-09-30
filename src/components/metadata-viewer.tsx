"use client";

import * as React from "react";

import { Copy, Info, Maximize, Workflow } from "lucide-react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { StoredImage } from "@/lib/image-db";

import { WorkflowViewer } from "./workflow-viewer";

interface MetadataViewerProps {
  imageFile: File | null;
  imageMetadata: StoredImage | null;
}

const MetadataItem = ({
  label,
  value,
  isCopyable = false,
}: {
  label: string;
  value: React.ReactNode;
  isCopyable?: boolean;
}) => (
  <div className="grid grid-cols-3 items-start gap-x-4 gap-y-1">
    <p className="text-sm font-medium text-muted-foreground col-span-1">{label}</p>
    <div className="col-span-2 flex items-start gap-2">
      <div className="break-all text-sm">{value}</div>
      {isCopyable && typeof value === 'string' && value && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success(`Copied ${label} to clipboard!`);
          }}
        >
          <Copy className="h-3 w-3" />
          <span className="sr-only">Copy {label}</span>
        </Button>
      )}
    </div>
  </div>
);

const LongMetadataItem = ({
  label,
  value,
  isCopyable = false,
}: {
  label: string;
  value: string | null;
  isCopyable?: boolean;
}) => {
  if (!value) return null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {isCopyable && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => {
              navigator.clipboard.writeText(value);
              toast.success(`Copied ${label} to clipboard!`);
            }}
          >
            <Copy className="h-3 w-3" />
            <span className="sr-only">Copy {label}</span>
          </Button>
        )}
      </div>
      <div className="mt-1.5 w-full overflow-hidden rounded-md border bg-muted/30">
        <ScrollArea className="h-full">
          <p className="p-2 text-sm leading-relaxed">{value}</p>
        </ScrollArea>
      </div>
    </div>
  );
};

export function MetadataViewer({ imageMetadata }: MetadataViewerProps) {
  const [isWorkflowJsonFullscreen, setIsWorkflowJsonFullscreen] = React.useState(false);
  const [isWorkflowGraphFullscreen, setIsWorkflowGraphFullscreen] = React.useState(false);
  const [fullWorkflow, setFullWorkflow] = React.useState<Record<string, unknown> | null>(null);

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

  const hasGeneratorMetadata = imageMetadata.prompt || imageMetadata.seed;

  const renderResolution = () => {
    if (imageMetadata.width === null || imageMetadata.height === null) {
      return <Skeleton className="h-4 w-24" />;
    }
    if (imageMetadata.width > 0 && imageMetadata.height > 0) {
      return `${imageMetadata.width} x ${imageMetadata.height}`;
    }
    return "N/A";
  };
  console.log('imageMetadat', imageMetadata)
  return (
    <div className="flex h-full flex-col min-w-[300px]">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-lg font-semibold">Metadata</h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">File Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <MetadataItem label="File Name" value={imageMetadata.name} isCopyable />
              <MetadataItem
                label="Resolution"
                value={renderResolution()}
              />
              <MetadataItem label="File Size" value={`${(imageMetadata.size / 1024).toFixed(2)} KB`} />
              <MetadataItem label="File Type" value={imageMetadata.type} />
              <MetadataItem
                label="Last Modified"
                value={new Date(imageMetadata.lastModified).toLocaleString()}
              />
            </CardContent>
          </Card>

          {imageMetadata.workflow && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Generator Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasGeneratorMetadata ? (
                  <>
                    <div className="gap-x-4 gap-y-3 pt-2">
                      {imageMetadata.seed && <MetadataItem label="Seed" value={String(imageMetadata.seed)} isCopyable />}
                      {imageMetadata.cfg && <MetadataItem
                        label="CFG Scale"
                        value={String(imageMetadata.cfg)}
                        isCopyable
                      />}
                      {imageMetadata.guidance && <MetadataItem
                        label="Guidance"
                        value={String(imageMetadata.guidance)}
                        isCopyable
                      />}
                      {imageMetadata.steps && <MetadataItem label="Steps" value={String(imageMetadata.steps)} isCopyable />}
                      {imageMetadata.frameRate && <MetadataItem label="Frame Rate" value={String(imageMetadata.frameRate)} isCopyable />}
                      {imageMetadata.duration && <MetadataItem label="Duration" value={String(imageMetadata.duration) + "s"} isCopyable />}
                      {imageMetadata.sampler && <MetadataItem
                        label="Sampler"
                        value={imageMetadata.sampler}
                        isCopyable
                      />}
                      {imageMetadata.scheduler && <MetadataItem
                        label="Scheduler"
                        value={imageMetadata.scheduler}
                        isCopyable
                      />}
                    </div>
                    <div className="space-y-3">
                      {imageMetadata.model && <MetadataItem
                        label="Model"
                        value={imageMetadata.model}
                        isCopyable
                      />}
                      {imageMetadata.loras && imageMetadata.loras.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">LoRAs</p>
                          <div className="space-y-2">
                            {imageMetadata.loras.map((lora, i) => (
                              <div key={`${lora.name}-${i}`} className="p-2 border rounded-md bg-muted/50">
                                <p className="font-semibold text-sm">{lora.name}</p>
                                <div className="flex text-xs text-muted-foreground mt-1">
                                  <span className="mr-4">Model: {Number(lora.strength_model).toFixed(2)}</span>
                                  {typeof lora.strength_clip === 'number' && <span>Clip: {Number(lora.strength_clip).toFixed(2)}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <LongMetadataItem
                        label="Positive Prompt"
                        value={imageMetadata.prompt}
                        isCopyable
                      />
                      <LongMetadataItem
                        label="Negative Prompt"
                        value={imageMetadata.negativePrompt}
                        isCopyable
                      />
                    </div>
                    {fullWorkflow && <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="item-1">
                        <div className="flex items-center justify-between">
                          <AccordionTrigger className="flex-1 text-sm">
                            Full Workflow
                          </AccordionTrigger>
                          <div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (fullWorkflow) {
                                  navigator.clipboard.writeText(JSON.stringify(fullWorkflow, null, 2));
                                  toast.success("Copied full workflow to clipboard!");
                                }
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsWorkflowGraphFullscreen(true);
                              }}
                            >
                              <Workflow className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsWorkflowJsonFullscreen(true);
                              }}
                            >
                              <Maximize className="h-4 w-4" />
                            </Button>
                          </div>
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
                      open={isWorkflowJsonFullscreen}
                      onOpenChange={setIsWorkflowJsonFullscreen}
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
                    <Dialog
                      open={isWorkflowGraphFullscreen}
                      onOpenChange={setIsWorkflowGraphFullscreen}
                    >
                      <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
                        <DialogHeader>
                          <DialogTitle>Workflow Graph</DialogTitle>
                        </DialogHeader>
                        <div className="flex-1">
                          <WorkflowViewer workflowJson={fullWorkflow} />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No generator metadata found in this image.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
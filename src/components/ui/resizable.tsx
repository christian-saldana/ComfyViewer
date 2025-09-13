"use client"

import * as React from "react"
import {
  Panel as PanelPrimitive,
  PanelGroup as PanelGroupPrimitive,
  PanelResizeHandle as PanelResizeHandlePrimitive,
} from "react-resizable-panels"

import { cn } from "@/lib/utils"

const ResizablePanelGroup = React.forwardRef<
  React.ElementRef<typeof PanelGroupPrimitive>,
  React.ComponentPropsWithoutRef<typeof PanelGroupPrimitive>
>(({ className, ...props }, ref) => (
  <PanelGroupPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
))
ResizablePanelGroup.displayName = "ResizablePanelGroup"

const ResizablePanel = PanelPrimitive

const ResizableHandle = React.forwardRef<
  React.ElementRef<typeof PanelResizeHandlePrimitive>,
  React.ComponentPropsWithoutRef<typeof PanelResizeHandlePrimitive> & {
    withHandle?: boolean
  }
>(({ className, withHandle, children, ...props }, ref) => (
  <PanelResizeHandlePrimitive
    ref={ref}
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <div className="h-2.5 w-px bg-muted-foreground" />
      </div>
    )}
    {children}
  </PanelResizeHandlePrimitive>
))
ResizableHandle.displayName = "ResizableHandle"

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
export type { ImperativePanelHandle } from "react-resizable-panels"
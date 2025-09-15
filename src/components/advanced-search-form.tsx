"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AdvancedSearchState {
  prompt: string;
  negativePrompt: string;
  seed: string;
  cfg: string;
  steps: string;
  sampler: string;
  scheduler: string;
}

interface AdvancedSearchFormProps {
  searchState: AdvancedSearchState;
  onSearchChange: (newState: Partial<AdvancedSearchState>) => void;
  onReset: () => void;
}

const searchFields: { key: keyof AdvancedSearchState; label: string }[] = [
  { key: "prompt", label: "Prompt" },
  { key: "negativePrompt", label: "Negative Prompt" },
  { key: "seed", label: "Seed" },
  { key: "cfg", label: "CFG Scale" },
  { key: "steps", label: "Steps" },
  { key: "sampler", label: "Sampler" },
  { key: "scheduler", label: "Scheduler" },
];

export function AdvancedSearchForm({
  searchState,
  onSearchChange,
  onReset,
}: AdvancedSearchFormProps) {
  const handleInputChange = (
    key: keyof AdvancedSearchState,
    value: string
  ) => {
    onSearchChange({ [key]: value });
  };

  return (
    <div className="space-y-4">
      {searchFields.map(({ key, label }) => (
        <div key={key} className="grid w-full items-center gap-1.5">
          <Label htmlFor={key}>{label}</Label>
          <Input
            type="text"
            id={key}
            placeholder={`Filter by ${label}...`}
            value={searchState[key]}
            onChange={(e) => handleInputChange(key, e.target.value)}
          />
        </div>
      ))}
      <Button onClick={onReset} variant="outline" className="w-full">
        <X className="mr-2 h-4 w-4" />
        Reset Advanced Filters
      </Button>
    </div>
  );
}
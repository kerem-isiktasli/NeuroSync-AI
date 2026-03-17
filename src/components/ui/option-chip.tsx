"use client";

import React from "react";
import { Check } from "lucide-react";

/**
 * Reusable option chip/button for single- or multi-select controls.
 * Provides clear visual states: default, hover, active, selected, focus, disabled.
 */
export interface OptionChipProps {
  selected?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  multi?: boolean;
  className?: string;
}

export function OptionChip({
  selected = false,
  disabled = false,
  children,
  onClick,
  multi = false,
  className = "",
}: OptionChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        relative flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium
        transition-all duration-200 cursor-pointer
        border-2
        focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-accent focus-visible:ring-offset-2 focus-visible:ring-offset-theme-bg
        active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${selected
          ? "bg-theme-accent text-theme-accent-foreground border-theme-accent shadow-md shadow-theme-accent/20"
          : "bg-theme-surface border-theme-border text-theme-text-secondary hover:border-theme-accent/50 hover:bg-theme-surface-elevated hover:text-theme-text-primary"
        }
        ${disabled && !selected ? "hover:border-theme-border hover:bg-theme-surface" : ""}
        ${className}
      `}
    >
      {multi && selected && (
        <Check size={14} className="shrink-0" strokeWidth={2.5} />
      )}
      {children}
    </button>
  );
}

/**
 * Option grid — renders OptionChips in a responsive grid.
 */
export interface OptionChipGridProps {
  options: Array<{ value: string; label: string; labelTr?: string }>;
  value?: string | null;
  multiValue?: string[];
  onChange?: (value: string) => void;
  onMultiChange?: (values: string[]) => void;
  multi?: boolean;
  language?: "tr" | "en";
  cols?: 2 | 3 | 4;
  invalid?: boolean;
}

export function OptionChipGrid({
  options,
  value,
  multiValue = [],
  onChange,
  onMultiChange,
  multi = false,
  language = "en",
  cols = 3,
  invalid = false,
}: OptionChipGridProps) {
  const gridCols =
    cols === 2
      ? "grid-cols-2"
      : cols === 4
        ? "grid-cols-2 sm:grid-cols-4"
        : "grid-cols-2 sm:grid-cols-3";

  return (
    <div
      className={`grid gap-2 ${gridCols} ${invalid ? "ring-2 ring-red-500 ring-offset-2 ring-offset-theme-bg rounded-xl p-1" : ""}`}
    >
      {options.map((opt) => {
        const selected = multi
          ? multiValue.includes(opt.value)
          : value === opt.value;
        const label = language === "tr" && opt.labelTr ? opt.labelTr : opt.label;

        return (
          <OptionChip
            key={opt.value}
            selected={selected}
            onClick={() => {
              if (multi && onMultiChange) {
                const cur = multiValue;
                onMultiChange(
                  cur.includes(opt.value)
                    ? cur.filter((v) => v !== opt.value)
                    : [...cur, opt.value]
                );
              } else if (onChange) {
                onChange(opt.value);
              }
            }}
            multi={multi}
          >
            {label}
          </OptionChip>
        );
      })}
    </div>
  );
}

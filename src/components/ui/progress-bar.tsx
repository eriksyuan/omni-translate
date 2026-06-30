import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  animated?: boolean;
}

export function ProgressBar({ className, value = 64, animated, ...props }: ProgressBarProps) {
  return (
    <div
      className={cn("flex-1 h-[6px] rounded-[3px] bg-control overflow-hidden", className)}
      {...props}
    >
      <div
        className={cn("h-full bg-accent", animated ? "transition-[width] duration-300 linear" : "")}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function ProgressLabel({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("font-mono text-[11px] text-fg-2", className)} {...props} />;
}

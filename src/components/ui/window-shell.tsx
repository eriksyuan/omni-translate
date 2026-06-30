import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function WindowShell({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <main className={cn("win-shell", className)} {...props} />;
}

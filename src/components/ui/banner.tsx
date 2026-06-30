import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Banner({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("banner", className)} {...props} />;
}

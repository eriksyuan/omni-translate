import * as SwitchPrimitive from "@radix-ui/react-switch";
import { type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export function Switch({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative w-[38px] h-[23px] shrink-0 cursor-pointer rounded-full bg-control flex items-center",
        "transition-colors duration-200 ease-mac",
        "data-[state=checked]:bg-success",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_45%,transparent)]",
        "disabled:opacity-45 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block w-[19px] h-[19px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]",
          "transition-transform duration-200 ease-mac translate-x-[2px]",
          "data-[state=checked]:translate-x-[17px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

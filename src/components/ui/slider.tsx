import * as SliderPrimitive from "@radix-ui/react-slider";
import { type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export function Slider({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex items-center select-none touch-none w-16 h-5", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative grow h-[4px] rounded-full bg-control">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          "block w-[14px] h-[14px] rounded-full bg-white border border-hairline border-solid",
          "shadow-[0_1px_3px_rgba(0,0,0,0.3)] focus-visible:outline-none",
          "focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_45%,transparent)]",
        )}
      />
    </SliderPrimitive.Root>
  );
}

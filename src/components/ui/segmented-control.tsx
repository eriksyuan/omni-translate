import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

type SegmentedControlProps = ComponentPropsWithoutRef<typeof ToggleGroup.Root> & {
  type?: "single";
};

export function SegmentedControl({ className, type = "single", ...props }: SegmentedControlProps) {
  return (
    <ToggleGroup.Root
      type={type}
      className={cn("inline-flex bg-control rounded-sm p-[2px] gap-[2px]", className)}
      {...props}
    />
  );
}

export function SegmentedControlItem({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof ToggleGroup.Item>) {
  return (
    <ToggleGroup.Item
      className={cn(
        "appearance-none border-0 bg-transparent cursor-pointer font-inherit",
        "text-[12.5px] font-510 text-fg-2 px-3 py-[5px] rounded-[6px]",
        "data-[state=on]:bg-win-solid data-[state=on]:text-fg data-[state=on]:shadow-[0_1px_2px_rgba(0,0,0,0.18)]",
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroup.Item>
  );
}

export { SegmentedControlItem as SegmentedItem };

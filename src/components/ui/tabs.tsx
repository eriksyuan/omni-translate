import * as TabsPrimitive from "@radix-ui/react-tabs";
import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("flex flex-col gap-[2px]", className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  children,
  icon,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { icon?: ReactNode }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "flex items-center gap-[11px] w-full px-[11px] py-[9px] rounded-sm cursor-pointer",
        "text-[13.5px] font-510 text-fg bg-transparent border-0 text-left",
        "transition-colors duration-120 hover:bg-hover",
        "data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:hover:bg-accent",
        "[&[data-state=active]_.tab-icon]:bg-white/22 [&[data-state=active]_.tab-icon]:text-white",
        className,
      )}
      {...props}
    >
      {icon ? <span className="tab-icon icon-box">{icon}</span> : null}
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ className, ...props }: ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />;
}

export function PreferencesShell({ className, children, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("flex min-h-full win-shell", className)} {...props}>
      {children}
    </div>
  );
}

export function PreferencesSidebar({ className, ...props }: ComponentPropsWithoutRef<"aside">) {
  return (
    <aside
      className={cn(
        "w-[210px] shrink-0 px-[10px] py-[14px] bg-panel border-r border-hairline border-solid",
        className,
      )}
      {...props}
    />
  );
}

export function PreferencesContent({ className, ...props }: ComponentPropsWithoutRef<"main">) {
  return (
    <main className={cn("flex-1 min-w-0 px-[30px] py-[26px] overflow-auto", className)} {...props} />
  );
}

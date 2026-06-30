import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface FormFieldProps extends HTMLAttributes<HTMLDivElement> {
  id?: string;
  label: ReactNode;
  description?: ReactNode;
  stacked?: boolean;
  controlClassName?: string;
  children: ReactNode;
}

export function FormField({
  id,
  label,
  description,
  stacked,
  controlClassName,
  className,
  children,
  ...props
}: FormFieldProps) {
  if (stacked) {
    return (
      <div className={cn("frow frow-col", className)} {...props}>
        <div className="min-w-0 w-full">
          <div className="text-[13.5px] font-510">
            {typeof label === "string" && id ? <label htmlFor={id}>{label}</label> : label}
          </div>
          {description ? (
            <div className="text-[11.5px] text-fg-2 mt-[3px] leading-[1.45]">{description}</div>
          ) : null}
        </div>
        <div className={cn("w-full max-w-none mt-[9px] flex flex-col", controlClassName)}>{children}</div>
      </div>
    );
  }

  return (
    <div className={cn("frow", className)} {...props}>
      <div className="min-w-0">
        <div className="text-[13.5px] font-510">
          {typeof label === "string" && id ? <label htmlFor={id}>{label}</label> : label}
        </div>
        {description ? (
          <div className="text-[11.5px] text-fg-2 mt-[3px] leading-[1.45]">{description}</div>
        ) : null}
      </div>
      <div className={cn("min-w-[200px] max-w-[240px] shrink-0", controlClassName)}>{children}</div>
    </div>
  );
}

export function FormCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("formcard", className)} {...props} />;
}

export function FormRow({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("frow", className)} {...props} />;
}

export function FormRowCol({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("frow frow-col", className)} {...props} />;
}

export function FormLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-[13.5px] font-510", className)} {...props} />;
}

export function FormDescription({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-[11.5px] text-fg-2 mt-[3px] leading-[1.45]", className)} {...props} />;
}

export function FormControl({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-[200px] max-w-[240px] shrink-0", className)} {...props} />;
}

export function FormControlWide({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full max-w-none mt-[9px]", className)} {...props} />;
}

export function FormFieldRow({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-[6px] px-4 py-[13px] border-b-[0.5px] border-sep border-solid last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

export function FormFieldLabel({ className, ...props }: HTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[12.5px] font-510 text-fg", className)} {...props} />;
}

export function FormHint({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("text-[11px] text-fg-2", className)} {...props} />;
}

export function FormGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-[22px]", className)} {...props} />;
}

export function FormGroupTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("eyebrow mb-[10px]", className)}
      {...props}
    />
  );
}

export function FormFootbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("footbar", className)} {...props} />;
}

export function FormReveal({
  open,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { open: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "overflow-hidden transition-[max-height] duration-300 ease-mac",
        open ? "max-h-[460px]" : "max-h-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Pane({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("pane-fade", className)} {...props} />;
}

export function PaneTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-[18px] font-620", className)} {...props} />;
}

export function PaneSub({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[13px] text-fg-2 mt-[6px] leading-[1.55]", className)} {...props} />;
}

export function FormRowLeft({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0", className)} {...props} />;
}

export function FormRowInline({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex gap-[10px] items-center", className)} {...props} />;
}

export function TestResult({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("text-[12px] mt-2 inline-flex items-center gap-[6px] text-success", className)}
      {...props}
    />
  );
}

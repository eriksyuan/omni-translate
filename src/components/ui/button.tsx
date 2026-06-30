import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva("btn", {
  variants: {
    variant: {
      default: "",
      primary: "btn-primary",
      ghost: "btn-ghost",
      danger: "btn-danger",
    },
    size: {
      default: "",
      lg: "btn-lg",
    },
    block: {
      true: "btn-block",
      false: "",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
    block: false,
  },
});

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, block }), className)} {...props} />
  ),
);
Button.displayName = "Button";

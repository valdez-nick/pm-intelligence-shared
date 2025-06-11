import * as React from "react"

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`relative overflow-auto ${className}`}
        {...props}
      >
        <div className="h-full w-full">
          {children}
        </div>
      </div>
    )
  }
)
ScrollArea.displayName = "ScrollArea"

interface ScrollBarProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
}

const ScrollBar = React.forwardRef<HTMLDivElement, ScrollBarProps>(
  ({ className = '', orientation = "vertical", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`touch-none select-none ${
          orientation === "horizontal" ? "h-2.5 w-full flex-col" : "h-full w-2.5"
        } ${className}`}
        {...props}
      />
    )
  }
)
ScrollBar.displayName = "ScrollBar"

export { ScrollArea, ScrollBar }
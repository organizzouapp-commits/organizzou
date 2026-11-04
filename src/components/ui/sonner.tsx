"use client"

import { useTheme } from "next-themes"
import { useIsMobile } from "@/hooks/use-mobile"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const isMobile = useIsMobile()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Desktop: top-right under the header. Phones: centered, calc(100% - 32px) wide, ABOVE the bottom nav and the assistant button
      // (nav height + 16px + the safe area), never over the top header. Toasts with an action ("Desfazer") last 8 s (set where they are
      // created), pause while hovered or touched, and swipe sideways to dismiss.
      position={isMobile ? "bottom-center" : "top-right"}
      duration={4000}
      swipeDirections={["left", "right"]}
      offset={isMobile ? { bottom: "calc(env(safe-area-inset-bottom) + 96px)", left: 16, right: 16 } : { top: "calc(env(safe-area-inset-top) + 84px)", right: 32 }}
      mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 96px)", left: 16, right: 16 }}
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !items-center !gap-3 !rounded-2xl !px-4 !py-3 !text-[14px] !leading-5",
          content: "min-w-0 flex-1",
          actionButton: "relative !ml-auto !h-9 !shrink-0 !rounded-full !border !border-foreground/40 !bg-transparent !px-4 !text-[14px] !leading-5 !font-semibold !text-foreground after:absolute after:-inset-1 hover:!bg-accent focus-visible:!ring-3 focus-visible:!ring-ring/50",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

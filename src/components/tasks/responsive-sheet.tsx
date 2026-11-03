"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

/** A dialog on desktop, a bottom sheet on phones: the same content either way. */
export function ResponsiveSheet({ open, onOpenChange, title, description, children, className }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: React.ReactNode; className?: string }) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[88dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription className={description ? undefined : "sr-only"}>{description ?? title}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[85dvh] overflow-y-auto rounded-[20px] sm:max-w-md", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : "sr-only"}>{description ?? title}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

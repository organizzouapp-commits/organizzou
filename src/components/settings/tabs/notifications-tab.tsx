"use client"

import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { NotificationsSettings } from "@/components/settings/settings-extras"

export default function NotificationsTab() {
  return (
    <Bento className="gap-4">
      <BentoCard className="col-span-12">
        <NotificationsSettings />
      </BentoCard>
    </Bento>
  )
}

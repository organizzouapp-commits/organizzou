"use client"

import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { AppearanceSettings } from "@/components/settings/settings-form"

export default function AppearanceTab() {
  return (
    <Bento className="gap-4">
      <BentoCard className="col-span-12">
        <AppearanceSettings />
      </BentoCard>
    </Bento>
  )
}

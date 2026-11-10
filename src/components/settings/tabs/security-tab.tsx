"use client"

import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { SecuritySettings } from "@/components/settings/settings-extras"

export default function SecurityTab() {
  return (
    <Bento className="gap-4">
      <BentoCard className="col-span-12">
        <SecuritySettings />
      </BentoCard>
    </Bento>
  )
}

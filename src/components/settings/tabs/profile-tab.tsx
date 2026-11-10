"use client"

import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { ProfileForm, PasswordForm } from "@/components/profile/profile-view"

export type SettingsProfile = { displayName: string; email: string; phone: string }

export default function ProfileTab({ profile }: { profile: SettingsProfile }) {
  return (
    <Bento className="@container gap-4">
      <BentoCard title="Seus dados" className="col-span-12 @min-[760px]:col-span-7">
        <ProfileForm {...profile} />
      </BentoCard>
      <BentoCard title="Alterar senha" className="col-span-12 @min-[760px]:col-span-5">
        <PasswordForm />
      </BentoCard>
    </Bento>
  )
}

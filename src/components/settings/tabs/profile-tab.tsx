"use client"

import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { PasswordForm, ProfileCard, ProfileForm } from "@/components/profile/profile-view"

export type SettingsProfile = { displayName: string; email: string; phone: string; createdAt?: string; avatarUrl?: string | null }

/** Perfil: the profile card on top, then "Seus dados" (7 columns) and "Alterar senha" (5); stacked on phones. */
export default function ProfileTab({ profile }: { profile: SettingsProfile }) {
  return (
    <div className="flex flex-col gap-4">
      <ProfileCard {...profile} />
      <Bento className="@container gap-4">
        <BentoCard title="Seus dados" className="col-span-12 @min-[760px]:col-span-7">
          <ProfileForm {...profile} />
        </BentoCard>
        <BentoCard title="Alterar senha" className="col-span-12 @min-[760px]:col-span-5">
          <PasswordForm />
        </BentoCard>
      </Bento>
    </div>
  )
}

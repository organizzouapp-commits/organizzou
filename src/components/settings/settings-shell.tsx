"use client"

import { useState } from "react"
import { BellIcon, MessageCircleIcon, PaletteIcon, ShieldCheckIcon, SparklesIcon, UserIcon } from "lucide-react"

import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { SettingsLayout, type SettingsSection } from "@/components/organizzou/layout"
import { ProfileForm, PasswordForm } from "@/components/profile/profile-view"

import { PlanSettings } from "./plan-settings"
import { NotificationsSettings, SecuritySettings, WhatsAppSettings } from "./settings-extras"
import { AppearanceSettings } from "./settings-form"

const SECTIONS: SettingsSection[] = [
  { id: "perfil", label: "Perfil", icon: UserIcon },
  { id: "aparencia", label: "Aparência", icon: PaletteIcon },
  { id: "avisos", label: "Avisos", icon: BellIcon },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircleIcon },
  { id: "seguranca", label: "Segurança e dados", icon: ShieldCheckIcon },
  { id: "plano", label: "Plano e cobrança", icon: SparklesIcon },
]

type Profile = { displayName: string; email: string; phone: string }

/** Perfil and Configurações are one screen: a vertical nav on desktop, scrollable tabs on phones, content in max-w-5xl. */
export function SettingsShell({ initial, profile }: { initial?: string; profile: Profile }) {
  const [active, setActive] = useState(SECTIONS.some((s) => s.id === initial) ? (initial as string) : "perfil")

  function change(id: string) {
    setActive(id)
    const url = new URL(window.location.href)
    url.searchParams.set("aba", id)
    window.history.replaceState(null, "", url)
  }

  return (
    <SettingsLayout sections={SECTIONS} active={active} onChange={change}>
      {active === "perfil" ? (
        <Bento className="@container">
          <BentoCard title="Seus dados" className="col-span-12 @min-[760px]:col-span-7">
            <ProfileForm {...profile} />
          </BentoCard>
          <BentoCard title="Alterar senha" className="col-span-12 @min-[760px]:col-span-5">
            <PasswordForm />
          </BentoCard>
        </Bento>
      ) : null}
      {active === "aparencia" ? (
        <BentoCard>
          <AppearanceSettings />
        </BentoCard>
      ) : null}
      {active === "avisos" ? (
        <BentoCard>
          <NotificationsSettings />
        </BentoCard>
      ) : null}
      {active === "whatsapp" ? (
        <BentoCard>
          <WhatsAppSettings />
        </BentoCard>
      ) : null}
      {active === "seguranca" ? (
        <BentoCard>
          <SecuritySettings />
        </BentoCard>
      ) : null}
      {active === "plano" ? (
        <BentoCard>
          <PlanSettings />
        </BentoCard>
      ) : null}
    </SettingsLayout>
  )
}

"use client"

import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { NotificationsSettings, SecuritySettings, WhatsAppSettings } from "./settings-extras"
import { SettingsForm } from "./settings-form"

type SettingsTabsProps = { displayName: string; email: string; initialTab?: string }

const TABS = ["perfil", "avisos", "whatsapp", "seguranca"]

export function SettingsTabs({ displayName, email, initialTab }: SettingsTabsProps) {
  const defaultValue = initialTab && TABS.includes(initialTab) ? initialTab : "perfil"

  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList>
        <TabsTrigger value="perfil">Perfil</TabsTrigger>
        <TabsTrigger value="avisos">Avisos</TabsTrigger>
        <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        <TabsTrigger value="seguranca">Segurança e dados</TabsTrigger>
      </TabsList>
      <TabsContent value="perfil" className="pt-5">
        <Bento>
          <BentoCard className="col-span-12 @min-[900px]:col-span-8">
            <SettingsForm displayName={displayName} email={email} />
          </BentoCard>
        </Bento>
      </TabsContent>
      <TabsContent value="avisos" className="pt-5">
        <Bento>
          <BentoCard className="col-span-12 @min-[900px]:col-span-9">
            <NotificationsSettings />
          </BentoCard>
        </Bento>
      </TabsContent>
      <TabsContent value="whatsapp" className="pt-5">
        <Bento>
          <BentoCard className="col-span-12 @min-[900px]:col-span-7">
            <WhatsAppSettings />
          </BentoCard>
        </Bento>
      </TabsContent>
      <TabsContent value="seguranca" className="pt-5">
        <Bento>
          <BentoCard className="col-span-12 @min-[900px]:col-span-8">
            <SecuritySettings />
          </BentoCard>
        </Bento>
      </TabsContent>
    </Tabs>
  )
}

"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { NotificationsSettings, SecuritySettings, WhatsAppSettings } from "./settings-extras"
import { SettingsForm } from "./settings-form"

type SettingsTabsProps = { displayName: string; email: string }

export function SettingsTabs({ displayName, email }: SettingsTabsProps) {
  return (
    <Tabs defaultValue="perfil">
      <TabsList>
        <TabsTrigger value="perfil">Perfil</TabsTrigger>
        <TabsTrigger value="avisos">Avisos</TabsTrigger>
        <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        <TabsTrigger value="seguranca">Segurança e dados</TabsTrigger>
      </TabsList>
      <TabsContent value="perfil" className="pt-6">
        <SettingsForm displayName={displayName} email={email} />
      </TabsContent>
      <TabsContent value="avisos" className="pt-6">
        <NotificationsSettings />
      </TabsContent>
      <TabsContent value="whatsapp" className="pt-6">
        <WhatsAppSettings />
      </TabsContent>
      <TabsContent value="seguranca" className="pt-6">
        <SecuritySettings />
      </TabsContent>
    </Tabs>
  )
}

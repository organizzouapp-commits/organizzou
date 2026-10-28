"use client"

import { Bento, BentoCard } from "@/components/organizzou/Bento"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { PlanSettings } from "./plan-settings"
import { NotificationsSettings, SecuritySettings, WhatsAppSettings } from "./settings-extras"
import { AppearanceSettings } from "./settings-form"

type SettingsTabsProps = { initialTab?: string }

const TABS = ["aparencia", "avisos", "whatsapp", "plano", "seguranca"]

export function SettingsTabs({ initialTab }: SettingsTabsProps) {
  const defaultValue = initialTab && TABS.includes(initialTab) ? initialTab : "aparencia"

  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList>
        <TabsTrigger value="aparencia">Aparência</TabsTrigger>
        <TabsTrigger value="avisos">Avisos</TabsTrigger>
        <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        <TabsTrigger value="plano">Plano e cobrança</TabsTrigger>
        <TabsTrigger value="seguranca">Segurança e dados</TabsTrigger>
      </TabsList>
      <TabsContent value="aparencia" className="pt-5">
        <Bento>
          <BentoCard className="col-span-12 @min-[900px]:col-span-8">
            <AppearanceSettings />
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
      <TabsContent value="plano" className="pt-5">
        <Bento>
          <BentoCard className="col-span-12 @min-[900px]:col-span-7">
            <PlanSettings />
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

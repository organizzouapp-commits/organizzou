import { adminNav } from "./admin-nav"
import { appNav } from "./app-nav"
import type { NavConfig } from "./nav-config"

/** Server layouts cannot pass icon components to the client shell, so they pass the id and the shell looks the config up here. */
export const NAVS: Record<NavConfig["id"], NavConfig> = { app: appNav, admin: adminNav }

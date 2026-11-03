"use client"

import { createContext, useContext } from "react"

import { DEFAULT_PRIORITY_STATE, type PriorityState } from "@/features/tasks/priorities"

/** The person's priority list and assignments, for the cards (flag) without threading props through every view. */
const PrioritiesContext = createContext<PriorityState>(DEFAULT_PRIORITY_STATE)

export const PrioritiesProvider = PrioritiesContext.Provider
export const usePriorities = () => useContext(PrioritiesContext)

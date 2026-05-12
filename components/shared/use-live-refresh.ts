"use client"

import { useEffect, useRef } from "react"

type UseLiveRefreshOptions = {
  enabled?: boolean
  intervalMs?: number
  quietWindowMs?: number
  focusDelayMs?: number
  minIntervalMs?: number
}

function isEditableTarget(target: Element | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const tagName = target.tagName.toLowerCase()

  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true
  }

  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
}

export function useLiveRefresh(
  refresh: () => void | Promise<void>,
  {
    enabled = true,
    intervalMs = 15000,
    quietWindowMs = 4000,
    focusDelayMs = 900,
    minIntervalMs = 2500,
  }: UseLiveRefreshOptions = {},
) {
  const refreshRef = useRef(refresh)
  const runningRef = useRef(false)
  const lastInteractionRef = useRef(0)
  const lastRefreshRef = useRef(0)
  const scheduledTimerRef = useRef<number | null>(null)

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    if (!enabled) {
      return
    }

    function markInteraction() {
      lastInteractionRef.current = Date.now()
    }

    async function runRefresh() {
      if (runningRef.current) {
        return
      }

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return
      }

      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return
      }

      if (typeof document !== "undefined" && isEditableTarget(document.activeElement)) {
        return
      }

      if (lastInteractionRef.current > 0 && Date.now() - lastInteractionRef.current < quietWindowMs) {
        return
      }

      if (lastRefreshRef.current > 0 && Date.now() - lastRefreshRef.current < minIntervalMs) {
        return
      }

      runningRef.current = true

      try {
        await refreshRef.current()
      } catch (error) {
        console.error(error)
      } finally {
        lastRefreshRef.current = Date.now()
        runningRef.current = false
      }
    }

    function scheduleRefresh(delay = focusDelayMs) {
      if (scheduledTimerRef.current !== null) {
        window.clearTimeout(scheduledTimerRef.current)
      }

      scheduledTimerRef.current = window.setTimeout(() => {
        scheduledTimerRef.current = null
        void runRefresh()
      }, delay)
    }

    function handleFocus() {
      scheduleRefresh()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        scheduleRefresh()
      }
    }

    const timer = window.setInterval(() => {
      void runRefresh()
    }, intervalMs)

    window.addEventListener("pointerdown", markInteraction, true)
    window.addEventListener("keydown", markInteraction, true)
    window.addEventListener("touchstart", markInteraction, true)
    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.clearInterval(timer)
      if (scheduledTimerRef.current !== null) {
        window.clearTimeout(scheduledTimerRef.current)
      }
      window.removeEventListener("pointerdown", markInteraction, true)
      window.removeEventListener("keydown", markInteraction, true)
      window.removeEventListener("touchstart", markInteraction, true)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [enabled, focusDelayMs, intervalMs, minIntervalMs, quietWindowMs])
}

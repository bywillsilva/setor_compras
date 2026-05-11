"use client"

import { useEffect, useRef } from "react"

type UseLiveRefreshOptions = {
  enabled?: boolean
  intervalMs?: number
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
  { enabled = true, intervalMs = 15000 }: UseLiveRefreshOptions = {},
) {
  const refreshRef = useRef(refresh)
  const runningRef = useRef(false)

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    if (!enabled) {
      return
    }

    async function runRefresh() {
      if (runningRef.current) {
        return
      }

      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return
      }

      if (typeof document !== "undefined" && isEditableTarget(document.activeElement)) {
        return
      }

      runningRef.current = true

      try {
        await refreshRef.current()
      } catch (error) {
        console.error(error)
      } finally {
        runningRef.current = false
      }
    }

    function handleFocus() {
      void runRefresh()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void runRefresh()
      }
    }

    const timer = window.setInterval(() => {
      void runRefresh()
    }, intervalMs)

    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [enabled, intervalMs])
}

import { isAfter, isBefore, parseISO } from "date-fns"

export function matchesDateRange(value: string | null | undefined, startDate?: string, endDate?: string) {
  if (!startDate && !endDate) {
    return true
  }

  if (!value) {
    return false
  }

  const target = parseISO(normalizeDateForParse(value))

  if (startDate) {
    const start = parseISO(`${startDate}T00:00:00`)
    if (isBefore(target, start)) {
      return false
    }
  }

  if (endDate) {
    const end = parseISO(`${endDate}T23:59:59`)
    if (isAfter(target, end)) {
      return false
    }
  }

  return true
}

function normalizeDateForParse(value: string) {
  if (value.includes("T")) {
    return value
  }

  return value.length === 10 ? `${value}T00:00:00` : value.replace(" ", "T")
}

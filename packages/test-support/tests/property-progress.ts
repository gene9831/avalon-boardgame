interface PropertyProgressOptions {
  label: string
  now?: () => number
  totalRuns: number
  write?: (message: string) => void
}

function formatElapsed(elapsedMs: number) {
  return `${Math.round(elapsedMs / 100) / 10}s`
}

export function createPropertyProgress({
  label,
  now = Date.now,
  totalRuns,
  write = console.log,
}: PropertyProgressOptions) {
  const startedAt = now()
  const reportEvery = Math.max(1, Math.ceil(totalRuns / 10))
  let completed = 0

  const report = (suffix = '') => {
    const percentage = Math.floor((completed / totalRuns) * 100)
    const elapsed = formatElapsed(now() - startedAt)
    write(
      `[property] ${label}: ${completed}/${totalRuns} (${percentage}%) elapsed=${elapsed}${suffix}`,
    )
  }

  report()

  return {
    advance() {
      completed = Math.min(completed + 1, totalRuns)
      if (completed < totalRuns && completed % reportEvery === 0) {
        report()
      }
    },
    complete() {
      completed = totalRuns
      report(' complete')
    },
  }
}

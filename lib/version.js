/**
 * Small semver helper for the update check. No dependency, no build step.
 */

function parseVersion(value) {
  const raw = String(value ?? '').trim().replace(/^v/i, '').split('+')[0]
  const [core, ...pre] = raw.split('-')
  const numbers = core.split('.').map((part) => {
    const number = Number.parseInt(part, 10)
    return Number.isFinite(number) ? number : 0
  })
  while (numbers.length < 3) numbers.push(0)
  return { numbers: numbers.slice(0, 3), pre: pre.join('-') }
}

/** Returns -1, 0, or 1 (stable releases sort above the same version with a prerelease tag). */
export function compareSemver(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) {
      return a.numbers[index] > b.numbers[index] ? 1 : -1
    }
  }
  if (a.pre && !b.pre) return -1
  if (!a.pre && b.pre) return 1
  if (a.pre && b.pre) return a.pre.localeCompare(b.pre, 'en', { numeric: true })
  return 0
}

export function isNewerVersion(latest, current) {
  return compareSemver(latest, current) > 0
}

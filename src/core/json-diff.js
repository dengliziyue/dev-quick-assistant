/**
 * JSON structural diff + line diff. Pure functions.
 * Unit tested in tests/core/json-diff.test.js
 */

const isPrim = (v) => v === null || typeof v !== 'object'

function keyPath(path, key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`
}

/**
 * Structural diff of two JSON texts.
 * @returns {{
 *   ok: boolean, errorLeft?, errorRight?,
 *   diffs: Array<{path, type:'added'|'removed'|'changed', left, right}>,
 *   summary: {added, removed, changed, unchanged},
 *   truncated: boolean
 * }}
 */
export function diffJson(aText, bText, { maxNodes = 200000, maxDiffs = 5000 } = {}) {
  const pa = parse(aText)
  const pb = parse(bText)
  if (!pa.ok || !pb.ok) {
    const out = { ok: false }
    if (!pa.ok) out.errorLeft = pa.error
    if (!pb.ok) out.errorRight = pb.error
    return out
  }
  const diffs = []
  const summary = { added: 0, removed: 0, changed: 0, unchanged: 0 }
  let nodes = 0
  let truncated = false

  function record(type, path, left, right) {
    summary[type]++
    if (diffs.length < maxDiffs) diffs.push({ path, type, left, right })
  }

  function walk(a, b, path) {
    if (++nodes > maxNodes) {
      truncated = true
      return
    }
    if (a === b) {
      summary.unchanged++
      return
    }
    if (isPrim(a) || isPrim(b)) {
      if (Array.isArray(a) || Array.isArray(b) || isPrim(a) !== isPrim(b)) {
        record('changed', path, a, b)
        return
      }
      if (a !== b) record('changed', path, a, b)
      return
    }
    const aArr = Array.isArray(a)
    const bArr = Array.isArray(b)
    if (aArr !== bArr) {
      record('changed', path, a, b)
      return
    }
    if (aArr) {
      const len = Math.max(a.length, b.length)
      for (let i = 0; i < len; i++) {
        if (++nodes > maxNodes) {
          truncated = true
          return
        }
        const inA = i < a.length
        const inB = i < b.length
        const p = `${path}[${i}]`
        if (inA && !inB) record('removed', p, a[i], undefined)
        else if (!inA && inB) record('added', p, undefined, b[i])
        else walk(a[i], b[i], p)
        if (truncated) return
      }
      return
    }
    const aKeys = Object.keys(a)
    const bKeys = new Set(Object.keys(b))
    for (const k of aKeys) {
      if (++nodes > maxNodes) {
        truncated = true
        return
      }
      const p = keyPath(path, k)
      if (bKeys.has(k)) {
        bKeys.delete(k)
        walk(a[k], b[k], p)
      } else {
        record('removed', p, a[k], undefined)
      }
      if (truncated) return
    }
    for (const k of bKeys) {
      if (++nodes > maxNodes) {
        truncated = true
        return
      }
      record('added', keyPath(path, k), undefined, b[k])
      if (truncated) return
    }
  }

  walk(pa.data, pb.data, '$')
  return { ok: true, diffs, summary, truncated }
}

function parse(text) {
  try {
    return { ok: true, data: JSON.parse(text) }
  } catch (e) {
    return { ok: false, error: { message: String((e && e.message) || e) } }
  }
}

/**
 * Line-level diff (LCS) for the side-by-side view.
 * Falls back to a coarse "replace" block when the DP budget is exceeded.
 * @returns {Array<{type:'same'|'add'|'del', text:string, aNo?:number, bNo?:number}>}
 */
export function lineDiff(aLines, bLines, { maxCells = 1600 * 1600 } = {}) {
  const n = aLines.length
  const m = bLines.length
  if (n * m > maxCells) {
    const out = aLines.map((text, i) => ({ type: 'del', text, aNo: i + 1 }))
    for (const [i, text] of bLines.entries()) out.push({ type: 'add', text, bNo: i + 1 })
    return out
  }
  // LCS DP
  const w = m + 1
  const dp = new Int32Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] =
        aLines[i] === bLines[j]
          ? dp[(i + 1) * w + j + 1] + 1
          : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1])
    }
  }
  const out = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) {
      out.push({ type: 'same', text: aLines[i], aNo: i + 1, bNo: j + 1 })
      i++
      j++
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) {
      out.push({ type: 'del', text: aLines[i], aNo: i + 1 })
      i++
    } else {
      out.push({ type: 'add', text: bLines[j], bNo: j + 1 })
      j++
    }
  }
  while (i < n) out.push({ type: 'del', text: aLines[i], aNo: ++i })
  while (j < m) out.push({ type: 'add', text: bLines[j], bNo: ++j })
  return out
}

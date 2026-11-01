import { describe, it, expect } from 'vitest'
import {
  extractTimestamps,
  tsToMs,
  datePartsInTz,
  tzOffsetMs,
  formatInTz,
  formatIso,
  parseDateInput,
  zonedTimeToUtc,
  relativeInfo,
  TIMEZONES
} from '../../src/core/time'

describe('extractTimestamps', () => {
  it('extracts 10 and 13 digit stamps from free text', () => {
    const text = 'created_at=1700000000 updated=1700000000000 id=99517x end'
    const res = extractTimestamps(text)
    expect(res).toHaveLength(2)
    expect(res[0]).toEqual({ raw: '1700000000', unit: 's', ms: 1700000000000 })
    expect(res[1]).toEqual({ raw: '1700000000000', unit: 'ms', ms: 1700000000000 })
  })

  it('ignores numbers that are too short/long', () => {
    expect(extractTimestamps('123456789 12345678901234 999999999')).toHaveLength(0)
  })

  it('handles empty input', () => {
    expect(extractTimestamps('')).toHaveLength(0)
    expect(extractTimestamps(null)).toHaveLength(0)
  })

  it('processes 1000 stamps quickly and correctly', () => {
    const text = Array.from({ length: 1000 }, (_, i) => String(1600000000 + i)).join(' ')
    const res = extractTimestamps(text)
    expect(res).toHaveLength(1000)
    expect(res[999].ms).toBe(1600000999000)
  })
})

describe('tsToMs', () => {
  it('handles seconds, milliseconds and auto detection', () => {
    expect(tsToMs(1700000000, 's')).toBe(1700000000000)
    expect(tsToMs(1700000000000, 'ms')).toBe(1700000000000)
    expect(tsToMs('1700000000')).toBe(1700000000000)
    expect(tsToMs('1700000000000')).toBe(1700000000000)
    expect(tsToMs('abc')).toBeNull()
    expect(tsToMs('')).toBeNull()
  })
})

describe('timezone helpers', () => {
  const instant = Date.UTC(2024, 0, 1, 0, 0, 0) // 2024-01-01T00:00:00Z

  it('datePartsInTz converts correctly', () => {
    const utc = datePartsInTz(new Date(instant), 'UTC')
    expect(utc).toMatchObject({ year: 2024, month: 1, day: 1, hour: 0, minute: 0, second: 0 })

    const shanghai = datePartsInTz(new Date(instant), 'Asia/Shanghai')
    expect(shanghai).toMatchObject({ year: 2024, month: 1, day: 1, hour: 8 })

    const ny = datePartsInTz(new Date(instant), 'America/New_York')
    expect(ny).toMatchObject({ year: 2023, month: 12, day: 31, hour: 19 })
  })

  it('tzOffsetMs respects DST', () => {
    const winter = Date.UTC(2024, 0, 15, 12, 0, 0)
    const summer = Date.UTC(2024, 6, 15, 12, 0, 0)
    expect(tzOffsetMs(new Date(winter), 'America/New_York')).toBe(-5 * 3600_000)
    expect(tzOffsetMs(new Date(summer), 'America/New_York')).toBe(-4 * 3600_000)
    expect(tzOffsetMs(new Date(winter), 'Asia/Shanghai')).toBe(8 * 3600_000)
  })

  it('formatInTz renders custom patterns', () => {
    const d = new Date(Date.UTC(2024, 5, 1, 14, 5, 9, 123))
    expect(formatInTz(d, 'UTC', 'yyyy/MM/dd HH:mm:ss')).toBe('2024/06/01 14:05:09')
    expect(formatInTz(d, 'UTC', 'dd日M月')).toBe('01日6月')
    expect(formatInTz(d, 'Asia/Shanghai', 'HH')).toBe('22')
    expect(formatInTz(d, 'UTC', 'SSS')).toBe('123')
  })

  it('formatIso is UTC ISO', () => {
    expect(formatIso(new Date(0))).toBe('1970-01-01T00:00:00.000Z')
  })
})

describe('parseDateInput', () => {
  it('parses wall-clock time in the chosen timezone', () => {
    const utc = parseDateInput('2024-06-01 12:00:00', 'UTC')
    expect(utc.date.getTime()).toBe(Date.UTC(2024, 5, 1, 12, 0, 0))

    const sh = parseDateInput('2024-06-01 12:00:00', 'Asia/Shanghai')
    expect(sh.date.getTime()).toBe(Date.UTC(2024, 5, 1, 4, 0, 0))

    const local = parseDateInput('2024-06-01 12:00:00', 'local')
    expect(local.date.getTime()).toBe(new Date(2024, 5, 1, 12, 0, 0).getTime())
  })

  it('interprets DST correctly via zonedTimeToUtc', () => {
    const edt = zonedTimeToUtc(2024, 7, 1, 12, 0, 0, 'America/New_York')
    expect(edt).toBe(Date.UTC(2024, 6, 1, 16, 0, 0))
    const est = zonedTimeToUtc(2024, 1, 1, 12, 0, 0, 'America/New_York')
    expect(est).toBe(Date.UTC(2024, 0, 1, 17, 0, 0))
  })

  it('parses ISO strings and date-only input', () => {
    expect(parseDateInput('2024-06-01T08:00:00Z', 'UTC').date.getTime()).toBe(
      Date.UTC(2024, 5, 1, 8, 0, 0)
    )
    const dateOnly = parseDateInput('2024-06-01', 'UTC')
    expect(dateOnly.date.getTime()).toBe(Date.UTC(2024, 5, 1, 0, 0, 0))
  })

  it('rejects garbage and out-of-range values', () => {
    expect(parseDateInput('not a date', 'UTC').ok).toBe(false)
    expect(parseDateInput('', 'UTC').ok).toBe(false)
    expect(parseDateInput('2024-13-01 00:00', 'UTC').ok).toBe(false)
    expect(parseDateInput('2024-01-32 00:00', 'UTC').ok).toBe(false)
  })

  it('supports slash format', () => {
    expect(parseDateInput('2024/06/01 08:30', 'UTC').date.getTime()).toBe(
      Date.UTC(2024, 5, 1, 8, 30, 0)
    )
  })
})

describe('relativeInfo', () => {
  it('classifies past and future durations', () => {
    expect(relativeInfo(0)).toMatchObject({ now: true })
    expect(relativeInfo(-30_000)).toMatchObject({ now: true, future: false })
    expect(relativeInfo(-90_000)).toMatchObject({ unit: 'unitMinute', future: false })
    expect(relativeInfo(-3 * 3600_000)).toMatchObject({ unit: 'unitHour' })
    expect(relativeInfo(-2 * 86_400_000)).toMatchObject({ unit: 'unitDay' })
    expect(relativeInfo(30_000)).toMatchObject({ now: true, future: true })
    expect(relativeInfo(2 * 3600_000)).toMatchObject({ unit: 'unitHour', future: true })
  })
})

describe('TIMEZONES list', () => {
  it('contains valid IANA zones accepted by Intl', () => {
    for (const tz of TIMEZONES) {
      expect(() => new Intl.DateTimeFormat('en-US', { timeZone: tz })).not.toThrow()
    }
  })
})

// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  collectPageStorage,
  writePageStorage,
  removePageStorageKey,
  clearPageStorage,
  collectPageImages
} from '../../src/utils/page-collectors'

describe('page storage collectors (injected functions)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('lists entries with sizes and previews', () => {
    localStorage.setItem('alpha', 'one')
    localStorage.setItem('beta', JSON.stringify({ x: 1 }))
    const res = collectPageStorage('local')
    expect(res.error).toBeUndefined()
    expect(res.total).toBe(2)
    const keys = res.items.map((i) => i.key)
    expect(keys).toContain('alpha')
    const alpha = res.items.find((i) => i.key === 'alpha')
    expect(alpha.value).toBe('one')
    expect(alpha.size).toBe('alpha'.length + 3)
    expect(alpha.truncated).toBe(false)
  })

  it('truncates big values in preview but keeps full value', () => {
    localStorage.setItem('big', 'v'.repeat(5000))
    const res = collectPageStorage('local', 100)
    const item = res.items[0]
    expect(item.truncated).toBe(true)
    expect(item.preview.length).toBe(100)
    expect(item.value.length).toBe(5000)
    expect(item.size).toBe(3 + 5000)
  })

  it('session kind reads sessionStorage', () => {
    sessionStorage.setItem('s1', 'v1')
    const res = collectPageStorage('session')
    expect(res.items.map((i) => i.key)).toEqual(['s1'])
  })

  it('write / remove / clear roundtrip and quota errors are contained', () => {
    expect(writePageStorage('local', 'k', 'v').ok).toBe(true)
    expect(localStorage.getItem('k')).toBe('v')
    expect(writePageStorage('local', 'k', 'v2').ok).toBe(true)
    expect(localStorage.getItem('k')).toBe('v2')

    expect(removePageStorageKey('local', 'k').ok).toBe(true)
    expect(localStorage.getItem('k')).toBeNull()

    writePageStorage('local', 'a', '1')
    writePageStorage('local', 'b', '2')
    expect(clearPageStorage('local').ok).toBe(true)
    expect(localStorage.length).toBe(0)
  })
})

describe('page image collector (injected function)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('collects img elements with absolute URLs and dimensions', () => {
    const img1 = document.createElement('img')
    img1.setAttribute('src', '/static/pic.png')
    Object.defineProperty(img1, 'currentSrc', { value: 'https://cdn.site.com/static/pic.png' })
    Object.defineProperty(img1, 'naturalWidth', { value: 640 })
    Object.defineProperty(img1, 'naturalHeight', { value: 480 })
    img1.alt = 'hero'
    const img2 = document.createElement('img')
    img2.setAttribute('src', 'logo.webp')
    Object.defineProperty(img2, 'naturalWidth', { value: 100 })
    Object.defineProperty(img2, 'naturalHeight', { value: 50 })
    document.body.append(img1, img2)

    const res = collectPageImages({ includeCss: false, includeIcons: false })
    expect(res.items).toHaveLength(2)
    expect(res.items[0]).toMatchObject({
      url: 'https://cdn.site.com/static/pic.png',
      w: 640,
      h: 480,
      alt: 'hero',
      source: 'img',
      type: 'png'
    })
    expect(res.items[1].url.endsWith('/logo.webp')).toBe(true)
    expect(res.items[1].type).toBe('webp')
  })

  it('dedupes repeated images', () => {
    for (let i = 0; i < 3; i++) {
      const img = document.createElement('img')
      img.setAttribute('src', 'https://x.com/same.png')
      document.body.append(img)
    }
    const res = collectPageImages({ includeCss: false, includeIcons: false })
    expect(res.items).toHaveLength(1)
  })

  it('collects CSS background images and site icons', () => {
    const div = document.createElement('div')
    div.style.backgroundImage = 'url(bg.jpg)'
    document.body.append(div)
    const link = document.createElement('link')
    link.rel = 'icon'
    link.setAttribute('href', '/favicon.ico')
    link.setAttribute('sizes', '32x32')
    document.head.append(link)

    const res = collectPageImages()
    const urls = res.items.map((i) => i.url)
    expect(urls.some((u) => u.endsWith('/bg.jpg'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/favicon.ico'))).toBe(true)
    const icon = res.items.find((i) => i.source === 'icon')
    expect(icon).toMatchObject({ w: 32, h: 32, type: 'ico' })
  })

  it('passes through data URLs and marks type data', () => {
    const img = document.createElement('img')
    img.setAttribute('src', 'data:image/png;base64,iVBORw0KGgo=')
    document.body.append(img)
    const res = collectPageImages({ includeCss: false, includeIcons: false })
    expect(res.items).toHaveLength(1)
    expect(res.items[0].type).toBe('data')
  })

  it('respects the max cap and flags saturation', () => {
    for (let i = 0; i < 10; i++) {
      const img = document.createElement('img')
      img.setAttribute('src', `https://x.com/${i}.png`)
      document.body.append(img)
    }
    const res = collectPageImages({ max: 3, includeCss: false, includeIcons: false })
    expect(res.items.length).toBeLessThanOrEqual(3)
    expect(res.saturated).toBe(true)
  })
})

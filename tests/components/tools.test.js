// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Base64Tool from '../../src/tools/Base64Tool.vue'
import JsonFormatter from '../../src/tools/JsonFormatter.vue'
import ThemeToggle from '../../src/components/ThemeToggle.vue'
import { settings } from '../../src/utils/settings'

describe('Base64Tool (component)', () => {
  beforeEach(() => {
    settings.theme = 'light'
  })

  it('encodes UTF-8 text and shows the result', async () => {
    const wrapper = mount(Base64Tool)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('你好')
    const buttons = wrapper.findAll('button')
    const encodeBtn = buttons.find((b) => b.text().includes('编码') || b.text().includes('Encode'))
    await encodeBtn.trigger('click')
    await flushPromises()
    const textareas = wrapper.findAll('textarea')
    expect(textareas[1].element.value).toBe('5L2g5aW9')
  })

  it('decodes and reports invalid input', async () => {
    const wrapper = mount(Base64Tool)
    const buttons = wrapper.findAll('button')
    const decodeBtn = buttons.find((b) => b.text().includes('解码') || b.text().includes('Decode'))
    const textarea = wrapper.find('textarea')
    await textarea.setValue('!!!not-base64!!!')
    await decodeBtn.trigger('click')
    await flushPromises()
    expect(wrapper.find('.alert.error').exists()).toBe(true)
  })
})

describe('JsonFormatter (component)', () => {
  it('formats valid JSON and renders highlighted output', async () => {
    const wrapper = mount(JsonFormatter)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('{"b":1,"a":2}')
    const fmtBtn = wrapper.findAll('button').find((b) => b.text().includes('格式化') || b.text().includes('Format'))
    await fmtBtn.trigger('click')
    await flushPromises()
    const pre = wrapper.find('pre')
    expect(pre.exists()).toBe(true)
    expect(pre.html()).toContain('tok-key')
  })

  it('shows a friendly error for invalid JSON', async () => {
    const wrapper = mount(JsonFormatter)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('{oops}')
    const fmtBtn = wrapper.findAll('button').find((b) => b.text().includes('格式化') || b.text().includes('Format'))
    await fmtBtn.trigger('click')
    await flushPromises()
    expect(wrapper.find('.alert.error').exists()).toBe(true)
  })

  it('escape produces a JSON string literal', async () => {
    const wrapper = mount(JsonFormatter)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('a"b')
    const escBtn = wrapper.findAll('button').find((b) => b.text().includes('转义') || b.text().includes('Escape'))
    await escBtn.trigger('click')
    await flushPromises()
    const pre = wrapper.find('pre')
    expect(pre.text()).toContain('"a\\"b"')
  })
})

describe('ThemeToggle (component)', () => {
  it('cycles the theme and updates data-theme', async () => {
    settings.theme = 'light'
    const wrapper = mount(ThemeToggle)
    await wrapper.find('button').trigger('click')
    expect(settings.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    await wrapper.find('button').trigger('click')
    expect(settings.theme).toBe('light')
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import {
  getToastDurationMs,
  ToastViewport,
} from '../src/toast'
import { appendToast, type ToastMessage } from '../src/toast-context'

const toast = (id: string): ToastMessage => ({
  id,
  message: `Message ${id}`,
  tone: 'info',
})

describe('toast notifications', () => {
  it('keeps only the three most recent messages', () => {
    const messages = ['1', '2', '3', '4'].reduce<ToastMessage[]>(
      (current, id) => appendToast(current, toast(id)),
      [],
    )

    expect(messages.map(({ id }) => id)).toEqual(['2', '3', '4'])
  })

  it('renders dismissible status and error messages in the global viewport', () => {
    const html = renderToStaticMarkup(
      <ToastViewport
        onDismiss={vi.fn()}
        toasts={[
          { id: 'status', message: '房间已创建', tone: 'success' },
          { id: 'error', message: '无法连接房间', tone: 'error' },
        ]}
      />,
    )

    expect(html).toContain('房间已创建')
    expect(html).toContain('无法连接房间')
    expect(html).toContain('role="status"')
    expect(html).toContain('role="alert"')
    expect(html.match(/aria-label="关闭通知"/g)).toHaveLength(2)
  })

  it('honors an explicit notification duration while preserving tone defaults', () => {
    expect(getToastDurationMs({ ...toast('success'), tone: 'success', durationMs: 3_000 }))
      .toBe(3_000)
    expect(getToastDurationMs({ ...toast('uncertain'), durationMs: 8_000 }))
      .toBe(8_000)
    expect(getToastDurationMs({ ...toast('error'), tone: 'error' })).toBe(8_000)
    expect(getToastDurationMs(toast('info'))).toBe(4_000)
  })
})

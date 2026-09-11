import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { IdentityRecognitionLayer } from '../src/IdentityRecognitionLayer'

describe('IdentityRecognitionLayer', () => {
  it('renders only an opaque curtain for a nonparticipant', () => {
    const html = renderToStaticMarkup(<IdentityRecognitionLayer overlay={{
      kind: 'identityRecognition', step: 'roleReveal', curtainState: 'closed',
      title: '查看你的身份', role: null,
    }} />)
    expect(html).toContain('data-curtain-state="closed"')
    expect(html).not.toContain('data-role-card')
    expect(html).not.toContain('<button')
  })

  it('renders authorized role content without a confirmation action', () => {
    const html = renderToStaticMarkup(<IdentityRecognitionLayer overlay={{
      kind: 'identityRecognition', step: 'roleReveal', curtainState: 'lowered',
      title: '查看你的身份', role: 'merlin',
    }} />)
    expect(html).toContain('data-role-card="merlin"')
    expect(html).not.toContain('<button')
  })
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const root = new URL('../../docs/06_User_RBAC/prototype/dai-339/', import.meta.url)
const html = readFileSync(new URL('index.html', root), 'utf8')
const css = readFileSync(new URL('styles.css', root), 'utf8')
const js = readFileSync(new URL('app.js', root), 'utf8')

test('prototype exposes all five role models and critical journeys', () => {
  for (const role of ['platform', 'tenant', 'manager', 'guard', 'member']) {
    assert.match(js, new RegExp(`\\b${role}: \\{`), `missing ${role} role model`)
    assert.match(html, new RegExp(`value="${role}"`), `missing ${role} role picker option`)
  }
  for (const scenario of [
    'Tenant lifecycle control',
    'Access request decision',
    'Exception escalation',
    'Verify and allow once',
    'Vehicle registration request',
  ]) assert.match(js, new RegExp(scenario))
})

test('every critical step can be reviewed in success, pending, and failure states', () => {
  for (const state of ['success', 'pending', 'failure']) {
    assert.match(html, new RegExp(`data-state="${state}"`))
    assert.match(js, new RegExp(`${state}: \\[`))
  }
  assert.match(html, /id="screen-state" class="state-banner"/)
  assert.match(html, /class="screen-stage" aria-live="polite"/)
  assert.match(js, /primary_action\.disabled = apiState === 'pending'/)
})

test('static document has keyboard and form-label foundations', () => {
  assert.match(html, /class="skip-link" href="#prototype-main"/)
  assert.match(html, /<main id="prototype-main"[^>]*tabindex="-1"/)
  assert.match(html, /<label for="role-picker">/)
  assert.match(html, /<label for="journey-picker">/)
  assert.match(html, /<legend>API state<\/legend>/)
  assert.match(html, /aria-label="Các bước critical path"/)
  assert.match(html, /aria-label="Yêu cầu thay đổi cụ thể"|<label for="change-request">/)
  assert.doesNotMatch(html, /onclick=/i)
})

test('responsive and accessibility tokens protect focus and touch targets', () => {
  assert.match(css, /min-height:\s*44px/)
  assert.match(css, /:focus-visible/)
  assert.match(css, /outline:\s*3px solid var\(--focus\)/)
  assert.match(css, /@media \(max-width: 950px\)/)
  assert.match(css, /@media \(max-width: 700px\)/)
  assert.doesNotMatch(css, /animation\s*:/i, 'prototype should not require motion')
  assert.doesNotMatch(css, /transition\s*:/i, 'prototype should not require motion')
})

test('review decisions are concrete and remain local-only', () => {
  assert.match(html, /id="approve-prototype"/)
  assert.match(html, /id="change-request"/)
  assert.match(js, /dai339-review-status/)
  assert.match(js, /dai339-change-requests/)
  assert.doesNotMatch(js, /\bfetch\s*\(/, 'static prototype must not call a live API')
})


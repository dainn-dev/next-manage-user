import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../app/vehicles/search/page.tsx', import.meta.url), 'utf8')

test('QR plate scanner explicitly requests device camera permission', () => {
  assert.match(page, /requestCameraAccess/)
  assert.match(page, /navigator\.mediaDevices\.getUserMedia\(CAMERA_CONSTRAINTS\)/)
  assert.match(page, /onClick=\{handleScannerToggle\}/)
  assert.match(page, /scannerStatus === 'requesting'/)
  assert.match(page, /Cấp quyền lại/)
})

test('QR scanner reuses the granted camera stream instead of opening camera implicitly', () => {
  assert.match(page, /decodeFromStream\(\s*scannerStream,/)
  assert.doesNotMatch(page, /decodeFromConstraints\(/)
  assert.match(page, /scannerStreamRef\.current\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/)
})

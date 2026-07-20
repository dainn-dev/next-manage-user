import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const hook = readFileSync(new URL("../hooks/use-qr-camera-scanner.ts", import.meta.url), "utf8")
const page = readFileSync(new URL("../app/me/visit/page.tsx", import.meta.url), "utf8")

test("shared QR scanner requests camera explicitly and cleans up the granted stream", () => {
  assert.match(hook, /navigator\.mediaDevices\.getUserMedia\(CAMERA_CONSTRAINTS\)/)
  assert.match(hook, /window\.isSecureContext/)
  assert.match(hook, /BarcodeDetector/)
  assert.match(hook, /BrowserQRCodeReader/)
  assert.match(hook, /decodeFromStream\(stream, video,/)
  assert.doesNotMatch(hook, /decodeFromConstraints\(/)
  assert.match(hook, /streamRef\.current\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/)
})

test("member visit scanner reuses the manual claim path and keeps a fallback", () => {
  assert.match(page, /useQrCameraScanner/)
  assert.match(page, /const claimCode = useCallback/)
  assert.match(page, /memberApi\.claimSession\(nextCode\)/)
  assert.match(page, /const nextCode = rawCode\.trim\(\)/)
  assert.match(page, /claimInFlightRef/)
  assert.match(page, /disabled=\{submitting \|\| !code\.trim\(\)\}/)
  assert.match(page, /<Input/)
  assert.match(page, /<Sheet open=\{scanner\.isOpen\}/)
  assert.match(page, /Quét QR bằng camera/)
})

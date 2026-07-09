/**
 * Trigger a browser download for a Blob (e.g. a file streamed from the backend
 * export/template endpoints). Creates a temporary object URL + anchor, clicks
 * it, then revokes the URL.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

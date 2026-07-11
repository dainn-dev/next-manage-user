/** Shared registration / org-profile management model options. */
export const MANAGEMENT_MODELS = [
  { value: "boarding-house", label: "Phòng trọ" },
  { value: "school", label: "Trường học" },
  { value: "retail", label: "Siêu thị" },
  { value: "airport", label: "Sân bay" },
  { value: "hospital", label: "Bệnh viện" },
  { value: "industrial-park", label: "Khu công nghiệp" },
  { value: "other", label: "Mô hình khác" },
] as const

export type ManagementModelValue = (typeof MANAGEMENT_MODELS)[number]["value"]

export function managementModelLabel(value?: string | null): string {
  if (!value) return "—"
  return MANAGEMENT_MODELS.find((m) => m.value === value)?.label ?? value
}

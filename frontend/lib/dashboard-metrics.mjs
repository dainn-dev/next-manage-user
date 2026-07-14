export function calculateOccupancyMetrics(slots) {
  const occupiedSlots = slots.filter((slot) => slot.status === 'OCCUPIED').length
  const availableSlots = slots.filter((slot) => slot.status === 'AVAILABLE').length
  const reservedSlots = slots.filter((slot) => slot.status === 'RESERVED').length
  const disabledSlots = slots.filter((slot) => slot.status === 'DISABLED').length
  const unknownSlots = slots.filter((slot) => slot.status === 'UNKNOWN').length
  const usableSlots = slots.length - disabledSlots

  return {
    totalSlots: slots.length,
    usableSlots,
    occupiedSlots,
    availableSlots,
    reservedSlots,
    disabledSlots,
    unknownSlots,
    currentVehicles: occupiedSlots,
    fillRate: usableSlots ? occupiedSlots / usableSlots : 0,
  }
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 phút'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes ? `${hours} giờ ${remainingMinutes} phút` : `${hours} giờ`
}

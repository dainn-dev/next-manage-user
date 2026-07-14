export function calculateOccupancyMetrics(slots) {
  const occupied = slots.filter((slot) => slot.status === 'OCCUPIED')
  const usable = slots.filter((slot) => slot.status !== 'DISABLED')
  return {
    currentVehicles: occupied.length,
    fillRate: usable.length ? occupied.length / usable.length : 0,
  }
}

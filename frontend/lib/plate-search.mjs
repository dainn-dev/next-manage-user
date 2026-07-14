export function canonicalPlate(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function validPlateQuery(value) {
  return canonicalPlate(value).length >= 2
}

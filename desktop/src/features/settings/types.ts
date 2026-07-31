export interface GateInfo {
  id: string
  name: string
  location: string | null
  gateType: 'ENTRANCE' | 'EXIT' | null
  status: 'online' | 'offline' | 'disabled'
}

export interface AssignedGate {
  gateId: string
  gateName: string
  gateType: 'ENTRANCE' | 'EXIT' | null
}

export interface GateAssignment {
  version: number
  siteId: string
  assignedGates: AssignedGate[]
  updatedAt: string
}

pub mod commands;
pub mod gate_store;

use serde::{Deserialize, Serialize};

/// A gate returned by the backend agent endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateInfo {
    pub id: String,
    pub name: String,
    pub location: Option<String>,
    #[serde(rename = "gateType")]
    pub gate_type: Option<String>,
    pub status: String,
}

/// Local configuration: which gates this app instance manages.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateAssignment {
    pub version: i32,
    #[serde(rename = "siteId")]
    pub site_id: String,
    #[serde(rename = "assignedGates")]
    pub assigned_gates: Vec<AssignedGate>,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignedGate {
    #[serde(rename = "gateId")]
    pub gate_id: String,
    #[serde(rename = "gateName")]
    pub gate_name: String,
    #[serde(rename = "gateType")]
    pub gate_type: Option<String>,
}

use super::{GateAssignment, GateInfo};
use super::gate_store;

#[tauri::command]
pub async fn fetch_site_gates(api_url: String, access_token: String) -> Result<Vec<GateInfo>, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/agent/gates", api_url))
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch gates: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Gate fetch failed: HTTP {}", response.status()));
    }

    let gates: Vec<GateInfo> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse gates: {}", e))?;

    Ok(gates)
}

#[tauri::command]
pub fn load_gate_assignment() -> Result<GateAssignment, String> {
    gate_store::load()
}

#[tauri::command]
pub fn save_gate_assignment(assignment: GateAssignment) -> Result<(), String> {
    gate_store::save(&assignment)
}

use super::GateAssignment;
use std::fs;
use std::path::PathBuf;

const ASSIGNMENT_FILE: &str = ".gate_assignment.json";

pub fn save(assignment: &GateAssignment) -> Result<(), String> {
    let path = assignment_path()?;
    let json =
        serde_json::to_string(assignment).map_err(|e| format!("Serialization error: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write gate assignment: {}", e))?;
    Ok(())
}

pub fn load() -> Result<GateAssignment, String> {
    let path = assignment_path()?;
    if !path.exists() {
        return Err("Gate assignment not configured".to_string());
    }
    let json =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read gate assignment: {}", e))?;
    let assignment: GateAssignment =
        serde_json::from_str(&json).map_err(|e| format!("Failed to parse gate assignment: {}", e))?;
    Ok(assignment)
}

pub fn delete() -> Result<(), String> {
    let path = assignment_path()?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete gate assignment: {}", e))?;
    }
    Ok(())
}

fn assignment_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or("Failed to get config directory")?
        .join("parking-site-agent");

    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;

    Ok(config_dir.join(ASSIGNMENT_FILE))
}

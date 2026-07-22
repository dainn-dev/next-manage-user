use super::AgentCredentials;
use std::fs;
use std::path::PathBuf;

// For MVP, store in local encrypted file
// Production should use Windows Credential Manager
const CRED_FILE: &str = ".agent_credentials.json";

pub fn store_credentials(credentials: &AgentCredentials) -> Result<(), String> {
    let config_dir = get_config_dir()?;
    let cred_path = config_dir.join(CRED_FILE);

    let json =
        serde_json::to_string(credentials).map_err(|e| format!("Serialization error: {}", e))?;

    // TODO: Encrypt before writing
    fs::write(&cred_path, json).map_err(|e| format!("Failed to write credentials: {}", e))?;

    Ok(())
}

pub fn load_credentials() -> Result<AgentCredentials, String> {
    let config_dir = get_config_dir()?;
    let cred_path = config_dir.join(CRED_FILE);

    if !cred_path.exists() {
        return Err("Credentials not found".to_string());
    }

    let json =
        fs::read_to_string(&cred_path).map_err(|e| format!("Failed to read credentials: {}", e))?;

    // TODO: Decrypt before parsing
    let credentials: AgentCredentials =
        serde_json::from_str(&json).map_err(|e| format!("Failed to parse credentials: {}", e))?;

    Ok(credentials)
}

pub fn delete_credentials() -> Result<(), String> {
    let config_dir = get_config_dir()?;
    let cred_path = config_dir.join(CRED_FILE);

    if cred_path.exists() {
        fs::remove_file(&cred_path).map_err(|e| format!("Failed to delete credentials: {}", e))?;
    }

    Ok(())
}

fn get_config_dir() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or("Failed to get config directory")?
        .join("parking-site-agent");

    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;

    Ok(config_dir)
}

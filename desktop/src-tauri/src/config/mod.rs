pub mod commands;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfig {
    pub version: i32,
    pub site_id: String,
    pub generated_at: String,
    pub cameras: Vec<CameraConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraConfig {
    pub id: String,
    pub name: String,
    pub role: String,
    pub panel_type: Option<String>,
    pub enabled: bool,
    pub source: CameraSource,
    pub pipeline_profile: String,
    pub revision: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraSource {
    #[serde(rename = "type")]
    pub source_type: String,
    pub url: String,
    pub username: Option<String>,
    pub password: Option<String>,
}

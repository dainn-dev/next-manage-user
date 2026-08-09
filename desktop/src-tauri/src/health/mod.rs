pub mod commands;
pub mod reporter;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStatus {
    pub online: bool,
    pub version: String,
    pub config_version: i32,
    pub workers: usize,
    pub queue_depth: usize,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraHealth {
    pub camera_id: String,
    pub state: String,
    pub last_frame_at: Option<String>,
    pub fps: f32,
    pub error: Option<String>,
}

pub mod commands;
pub mod credential_store;
pub mod token_manager;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentCredentials {
    pub agent_id: String,
    pub site_id: String,
    pub tenant_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrollmentRequest {
    pub enrollment_code: String,
    pub name: String,
    pub device_fingerprint: String,
    pub version: String,
    pub platform: String,
}

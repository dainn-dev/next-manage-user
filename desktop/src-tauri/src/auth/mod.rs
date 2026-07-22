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
    #[serde(default = "default_api_url")]
    pub api_url: String,
}

fn default_api_url() -> String {
    "http://localhost:8080".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrollmentRequest {
    pub enrollment_code: String,
    pub name: String,
    pub device_fingerprint: String,
    pub version: String,
    pub platform: String,
}

#[cfg(test)]
mod tests {
    use super::{AgentCredentials, EnrollmentRequest};

    #[test]
    fn enrollment_request_uses_backend_camel_case_contract() {
        let request = EnrollmentRequest {
            enrollment_code: "ABCD-EFGH".to_string(),
            name: "Test agent".to_string(),
            device_fingerprint: "fingerprint".to_string(),
            version: "0.1.0".to_string(),
            platform: "linux-x86_64".to_string(),
        };

        let json = serde_json::to_value(request).expect("request should serialize");

        assert_eq!(json["enrollmentCode"], "ABCD-EFGH");
        assert_eq!(json["deviceFingerprint"], "fingerprint");
        assert!(json.get("enrollment_code").is_none());
        assert!(json.get("device_fingerprint").is_none());
    }

    #[test]
    fn legacy_credentials_default_to_local_backend() {
        let credentials: AgentCredentials = serde_json::from_value(serde_json::json!({
            "agent_id": "agent",
            "site_id": "site",
            "tenant_id": "tenant",
            "access_token": "access",
            "refresh_token": "refresh",
            "expires_at": 0
        }))
        .expect("legacy credentials should remain readable");

        assert_eq!(credentials.api_url, "http://localhost:8080");
    }
}

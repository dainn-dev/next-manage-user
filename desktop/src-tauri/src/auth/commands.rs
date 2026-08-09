use super::{AgentCredentials, EnrollmentRequest};

const AUTH_REVOKED: &str = "AUTH_REVOKED";
const AUTH_INVALID: &str = "AUTH_INVALID";
const AUTH_UNAVAILABLE: &str = "AUTH_UNAVAILABLE";

#[tauri::command]
pub async fn enroll_agent(
    enrollment_code: String,
    name: String,
    api_url: String,
) -> Result<AgentCredentials, String> {
    let client = reqwest::Client::new();
    let api_url = api_url.trim_end_matches('/').to_string();

    // Get device fingerprint (simplified for MVP)
    let device_fingerprint = format!("{:x}", md5::compute(whoami::hostname()));

    let request = EnrollmentRequest {
        enrollment_code,
        name,
        device_fingerprint,
        version: "0.1.0".to_string(),
        platform: format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH),
    };

    let response = client
        .post(format!("{}/api/agent/enroll", api_url))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Enrollment failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Enrollment failed: {}", error_text));
    }

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let credentials = AgentCredentials {
        agent_id: result["agentId"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        site_id: result["siteId"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        tenant_id: result["tenantId"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        access_token: result["accessToken"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        refresh_token: result["refreshToken"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        expires_at: chrono::Utc::now().timestamp() + 3600,
        api_url,
    };

    // Store credentials securely
    super::credential_store::store_credentials(&credentials)
        .map_err(|e| format!("Failed to store credentials: {}", e))?;

    let _ = crate::health::reporter::start_health_reporter().await;

    Ok(credentials)
}

#[tauri::command]
pub async fn check_credentials() -> Result<AgentCredentials, String> {
    let mut credentials = super::credential_store::load_credentials()
        .map_err(|e| format!("NO_CREDENTIALS: {}", e))?;
    let client = reqwest::Client::new();

    let credentials = match validate_access(&client, &credentials).await? {
        AccessValidation::Valid => credentials,
        AccessValidation::Revoked => return revoke_local_credentials(AUTH_REVOKED),
        AccessValidation::RefreshRequired => {
            refresh_access_token(&client, &mut credentials).await?;
            match validate_access(&client, &credentials).await? {
                AccessValidation::Valid => {
                    super::credential_store::store_credentials(&credentials)?;
                    credentials
                }
                AccessValidation::Revoked => return revoke_local_credentials(AUTH_REVOKED),
                AccessValidation::RefreshRequired => {
                    return revoke_local_credentials(AUTH_INVALID)
                }
            }
        }
    };

    let _ = crate::health::reporter::start_health_reporter().await;
    Ok(credentials)
}

enum AccessValidation {
    Valid,
    Revoked,
    RefreshRequired,
}

async fn validate_access(
    client: &reqwest::Client,
    credentials: &AgentCredentials,
) -> Result<AccessValidation, String> {
    let response = client
        .get(format!("{}/api/agent/config", credentials.api_url.trim_end_matches('/')))
        .header(
            "Authorization",
            format!("Bearer {}", credentials.access_token),
        )
        .send()
        .await
        .map_err(|e| format!("{}: Backend connection failed: {}", AUTH_UNAVAILABLE, e))?;

    let status = response.status();
    if status.is_success() || status.as_u16() == 304 {
        return Ok(AccessValidation::Valid);
    }

    let body = response.text().await.unwrap_or_default();
    if is_revoked_response(&body) {
        return Ok(AccessValidation::Revoked);
    }
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Ok(AccessValidation::RefreshRequired);
    }

    Err(format!(
        "{}: Backend validation failed with status {}",
        AUTH_UNAVAILABLE, status
    ))
}

async fn refresh_access_token(
    client: &reqwest::Client,
    credentials: &mut AgentCredentials,
) -> Result<(), String> {
    let response = client
        .post(format!(
            "{}/api/agent/token/refresh?agentId={}",
            credentials.api_url.trim_end_matches('/'),
            credentials.agent_id
        ))
        .json(&serde_json::json!({ "refreshToken": credentials.refresh_token }))
        .send()
        .await
        .map_err(|e| format!("{}: Token refresh failed: {}", AUTH_UNAVAILABLE, e))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        if is_revoked_response(&body) {
            return revoke_local_credentials(AUTH_REVOKED);
        }
        if status.as_u16() == 400 || status.as_u16() == 401 || status.as_u16() == 403 {
            return revoke_local_credentials(AUTH_INVALID);
        }
        return Err(format!(
            "{}: Token refresh failed with status {}",
            AUTH_UNAVAILABLE, status
        ));
    }

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("{}: Invalid refresh response: {}", AUTH_UNAVAILABLE, e))?;
    let access_token = result["accessToken"]
        .as_str()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("{}: Refresh response omitted access token", AUTH_UNAVAILABLE))?;

    credentials.access_token = access_token.to_string();
    credentials.expires_at = chrono::Utc::now().timestamp() + 3600;
    super::credential_store::store_credentials(credentials)?;
    Ok(())
}

fn is_revoked_response(body: &str) -> bool {
    body.to_ascii_lowercase().contains("revoked")
}

fn revoke_local_credentials<T>(reason: &str) -> Result<T, String> {
    super::credential_store::delete_credentials()
        .map_err(|e| format!("Failed to clear revoked credentials: {}", e))?;
    Err(reason.to_string())
}

#[cfg(test)]
mod tests {
    use super::is_revoked_response;

    #[test]
    fn recognizes_revoked_backend_response() {
        assert!(is_revoked_response(r#"{"error":"Agent revoked"}"#));
        assert!(is_revoked_response(r#"{"message":"AGENT REVOKED"}"#));
        assert!(!is_revoked_response(r#"{"error":"Invalid token"}"#));
    }
}

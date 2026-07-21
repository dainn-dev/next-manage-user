use super::AgentCredentials;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct TokenManager {
    credentials: Arc<Mutex<Option<AgentCredentials>>>,
    api_url: String,
}

impl TokenManager {
    pub fn new(api_url: String) -> Self {
        Self {
            credentials: Arc::new(Mutex::new(None)),
            api_url,
        }
    }

    pub async fn get_valid_token(&self) -> Result<String, String> {
        let mut creds = self.credentials.lock().await;

        if creds.is_none() {
            // Try to load from storage
            match super::credential_store::load_credentials() {
                Ok(stored_creds) => {
                    *creds = Some(stored_creds);
                }
                Err(_) => return Err("Not authenticated".to_string()),
            }
        }

        let credentials = creds.as_ref().unwrap();
        let now = chrono::Utc::now().timestamp();

        // Check if token is expired or about to expire (within 1 minute)
        if credentials.expires_at - now < 60 {
            // Refresh token
            let new_creds = self.refresh_token(&credentials.refresh_token).await?;
            *creds = Some(new_creds.clone());
            super::credential_store::store_credentials(&new_creds)?;
            Ok(new_creds.access_token)
        } else {
            Ok(credentials.access_token.clone())
        }
    }

    async fn refresh_token(&self, refresh_token: &str) -> Result<AgentCredentials, String> {
        let client = reqwest::Client::new();

        let response = client
            .post(format!("{}/api/agent/token/refresh", self.api_url))
            .json(&serde_json::json!({
                "refreshToken": refresh_token
            }))
            .send()
            .await
            .map_err(|e| format!("Token refresh failed: {}", e))?;

        if !response.status().is_success() {
            return Err("Token refresh failed".to_string());
        }

        let result: serde_json::Value = response.json().await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        // Load existing credentials and update tokens
        let mut creds = super::credential_store::load_credentials()?;
        creds.access_token = result["accessToken"].as_str().unwrap_or_default().to_string();
        creds.expires_at = chrono::Utc::now().timestamp() + 900; // 15 minutes

        Ok(creds)
    }
}

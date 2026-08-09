use crate::auth::{credential_store, AgentCredentials};
use crate::config::AgentConfig;
use chrono::Utc;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

const HEARTBEAT_INTERVAL_SECS: u64 = 20;
const AGENT_VERSION: &str = "0.1.0";

static REPORTER_RUNNING: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentHeartbeatRequest {
    version: String,
    started_at: String,
    config_version: i32,
    cpu_percent: Option<f64>,
    memory_mb: Option<i64>,
    queue_depth: i32,
    workers: i32,
    last_ip: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CameraHealthRequest {
    connection_state: String,
    last_frame_at: Option<String>,
    fps: Option<f64>,
    width: Option<i32>,
    height: Option<i32>,
    codec: Option<String>,
    reconnect_count: Option<i32>,
    queue_depth: Option<i32>,
    error_code: Option<String>,
    error_message_safe: Option<String>,
    config_version: Option<i32>,
}

#[derive(Default, Clone)]
struct ReporterState {
    started_at: String,
    config_version: i32,
    workers: i32,
    last_ok_at: Option<String>,
    last_error: Option<String>,
}

fn reporter_state() -> &'static Mutex<ReporterState> {
    static STATE: OnceLock<Mutex<ReporterState>> = OnceLock::new();
    STATE.get_or_init(|| {
        Mutex::new(ReporterState {
            started_at: local_now(),
            ..ReporterState::default()
        })
    })
}

fn local_now() -> String {
    Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

/// Starts a background loop that posts agent + camera health to the backend.
/// Safe to call multiple times — only one loop runs.
pub async fn start_health_reporter() -> Result<(), String> {
    if REPORTER_RUNNING.swap(true, Ordering::SeqCst) {
        return Ok(());
    }

    {
        let mut state = reporter_state()
            .lock()
            .map_err(|_| "Health reporter state poisoned".to_string())?;
        state.started_at = local_now();
        state.last_error = None;
    }

    tokio::spawn(async move {
        let client = reqwest::Client::new();
        loop {
            if let Err(error) = tick_once(&client).await {
                eprintln!("[health] heartbeat failed: {}", error);
                if let Ok(mut state) = reporter_state().lock() {
                    state.last_error = Some(error);
                }
            } else if let Ok(mut state) = reporter_state().lock() {
                state.last_ok_at = Some(local_now());
                state.last_error = None;
            }
            tokio::time::sleep(Duration::from_secs(HEARTBEAT_INTERVAL_SECS)).await;
        }
    });

    Ok(())
}

pub fn reporter_snapshot() -> Result<(bool, i32, i32, Option<String>), String> {
    let state = reporter_state()
        .lock()
        .map_err(|_| "Health reporter state poisoned".to_string())?;
    let online = state.last_ok_at.is_some() && state.last_error.is_none();
    Ok((
        online,
        state.config_version,
        state.workers,
        state.last_error.clone(),
    ))
}

async fn tick_once(client: &reqwest::Client) -> Result<(), String> {
    let mut credentials = credential_store::load_credentials()
        .map_err(|e| format!("NO_CREDENTIALS: {}", e))?;

    ensure_access_token(client, &mut credentials).await?;

    let config = fetch_config(client, &credentials).await?;
    let workers = config.cameras.iter().filter(|camera| camera.enabled).count() as i32;
    let config_version = config.version;

    if let Ok(mut state) = reporter_state().lock() {
        state.config_version = config_version;
        state.workers = workers;
    }

    post_agent_heartbeat(client, &credentials, config_version, workers).await?;

    for camera in &config.cameras {
        if !camera.enabled || camera.source.url.trim().is_empty() {
            continue;
        }
        post_camera_health(client, &credentials, camera).await?;
    }

    Ok(())
}

async fn ensure_access_token(
    client: &reqwest::Client,
    credentials: &mut AgentCredentials,
) -> Result<(), String> {
    if credentials.expires_at > Utc::now().timestamp() + 60 {
        return Ok(());
    }

    let response = client
        .post(format!(
            "{}/api/agent/token/refresh?agentId={}",
            credentials.api_url.trim_end_matches('/'),
            credentials.agent_id
        ))
        .json(&serde_json::json!({ "refreshToken": credentials.refresh_token }))
        .send()
        .await
        .map_err(|e| format!("Token refresh failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Token refresh failed with status {}",
            response.status()
        ));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Invalid refresh response: {}", e))?;
    let access_token = body["accessToken"]
        .as_str()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Refresh response omitted access token".to_string())?;

    credentials.access_token = access_token.to_string();
    credentials.expires_at = Utc::now().timestamp() + 3600;
    credential_store::store_credentials(credentials)?;
    Ok(())
}

async fn fetch_config(
    client: &reqwest::Client,
    credentials: &AgentCredentials,
) -> Result<AgentConfig, String> {
    let response = client
        .get(format!(
            "{}/api/agent/config",
            credentials.api_url.trim_end_matches('/')
        ))
        .header(
            "Authorization",
            format!("Bearer {}", credentials.access_token),
        )
        .send()
        .await
        .map_err(|e| format!("Config fetch failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Config fetch failed with status {}",
            response.status()
        ));
    }

    response
        .json()
        .await
        .map_err(|e| format!("Failed to parse config: {}", e))
}

async fn post_agent_heartbeat(
    client: &reqwest::Client,
    credentials: &AgentCredentials,
    config_version: i32,
    workers: i32,
) -> Result<(), String> {
    let started_at = reporter_state()
        .lock()
        .map(|state| state.started_at.clone())
        .unwrap_or_else(|_| local_now());

    let body = AgentHeartbeatRequest {
        version: AGENT_VERSION.to_string(),
        started_at,
        config_version,
        cpu_percent: None,
        memory_mb: None,
        queue_depth: 0,
        workers,
        last_ip: None,
    };

    let response = client
        .post(format!(
            "{}/api/agent/heartbeat",
            credentials.api_url.trim_end_matches('/')
        ))
        .header(
            "Authorization",
            format!("Bearer {}", credentials.access_token),
        )
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Agent heartbeat failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Agent heartbeat failed with status {}",
            response.status()
        ));
    }
    Ok(())
}

async fn post_camera_health(
    client: &reqwest::Client,
    credentials: &AgentCredentials,
    camera: &crate::config::CameraConfig,
) -> Result<(), String> {
    // Until Python sidecars report real frames, mark owned cameras as connecting so
    // the website can show the agent is responsible for them.
    let body = CameraHealthRequest {
        connection_state: "connecting".to_string(),
        last_frame_at: Some(local_now()),
        fps: None,
        width: None,
        height: None,
        codec: None,
        reconnect_count: Some(0),
        queue_depth: Some(0),
        error_code: None,
        error_message_safe: None,
        config_version: Some(camera.revision),
    };

    let response = client
        .post(format!(
            "{}/api/agent/cameras/{}/health",
            credentials.api_url.trim_end_matches('/'),
            camera.id
        ))
        .header(
            "Authorization",
            format!("Bearer {}", credentials.access_token),
        )
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Camera {} health failed: {}", camera.id, e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Camera {} health failed with status {}",
            camera.id,
            response.status()
        ));
    }
    Ok(())
}

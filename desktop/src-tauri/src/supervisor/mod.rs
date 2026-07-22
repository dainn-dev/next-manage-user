pub mod commands;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::thread;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerHandle {
    pub camera_id: String,
    pub pid: Option<u32>,
    pub state: WorkerState,
    pub revision: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkerState {
    Starting,
    Running,
    Stopping,
    Stopped,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum IPCEvent {
    #[serde(rename = "stream.connected")]
    StreamConnected {
        #[serde(rename = "cameraId")]
        camera_id: String,
        width: i32,
        height: i32,
        fps: f32,
        codec: String,
        at: String,
    },
    #[serde(rename = "stream.error")]
    StreamError {
        #[serde(rename = "cameraId")]
        camera_id: String,
        code: String,
        message: String,
        at: String,
    },
    #[serde(rename = "frame.observed")]
    FrameObserved {
        #[serde(rename = "cameraId")]
        camera_id: String,
        #[serde(rename = "frameNumber")]
        frame_number: i32,
        at: String,
    },
    #[serde(rename = "queue.depth")]
    QueueDepth {
        #[serde(rename = "cameraId")]
        camera_id: String,
        depth: i32,
        at: String,
    },
    #[serde(rename = "worker.ready")]
    WorkerReady {
        #[serde(rename = "cameraId")]
        camera_id: String,
        #[serde(rename = "configRevision")]
        config_revision: i32,
        at: String,
    },
}

pub struct Supervisor {
    workers: Mutex<HashMap<String, WorkerHandle>>,
}

impl Supervisor {
    pub fn new() -> Self {
        Self {
            workers: Mutex::new(HashMap::new()),
        }
    }

    pub async fn start_worker(
        &self,
        camera_id: String,
        config: &crate::config::CameraConfig,
    ) -> Result<(), String> {
        let mut workers = self.workers.lock().await;

        // Spawn Python sidecar process
        let sidecar_path = get_sidecar_path()?;

        let mut child = Command::new(sidecar_path)
            .arg("--run-camera")
            .arg("--config")
            .arg("-") // Read config from stdin
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn worker: {}", e))?;

        let pid = child.id();

        // Write config to stdin
        if let Some(mut stdin) = child.stdin.take() {
            use std::io::Write;
            let config_json = serde_json::to_string(config)
                .map_err(|e| format!("Failed to serialize config: {}", e))?;
            stdin
                .write_all(config_json.as_bytes())
                .map_err(|e| format!("Failed to write config: {}", e))?;
        }

        // Spawn thread to read JSON Lines from stdout
        if let Some(stdout) = child.stdout.take() {
            let camera_id_clone = camera_id.clone();
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    match line {
                        Ok(json_line) => {
                            if let Ok(event) = serde_json::from_str::<IPCEvent>(&json_line) {
                                handle_ipc_event(event);
                            } else {
                                eprintln!("Failed to parse IPC event: {}", json_line);
                            }
                        }
                        Err(e) => {
                            eprintln!("Error reading worker stdout: {}", e);
                            break;
                        }
                    }
                }
                eprintln!("Worker {} stdout closed", camera_id_clone);
            });
        }

        let handle = WorkerHandle {
            camera_id: camera_id.clone(),
            pid: Some(pid),
            state: WorkerState::Starting,
            revision: config.revision,
        };

        workers.insert(camera_id, handle);
        Ok(())
    }

    pub async fn stop_worker(&self, camera_id: &str) -> Result<(), String> {
        let mut workers = self.workers.lock().await;

        if let Some(handle) = workers.get_mut(camera_id) {
            handle.state = WorkerState::Stopping;

            // Kill process gracefully (SIGTERM on Unix, terminate on Windows)
            if let Some(pid) = handle.pid {
                #[cfg(unix)]
                {
                    use nix::sys::signal::{kill, Signal};
                    use nix::unistd::Pid;
                    let _ = kill(Pid::from_raw(pid as i32), Signal::SIGTERM);
                }

                #[cfg(windows)]
                {
                    // TODO: Implement graceful shutdown on Windows
                }
            }
        }

        workers.remove(camera_id);
        Ok(())
    }

    pub async fn get_worker_status(&self, camera_id: &str) -> Option<WorkerHandle> {
        let workers = self.workers.lock().await;
        workers.get(camera_id).cloned()
    }

    pub async fn list_workers(&self) -> Vec<WorkerHandle> {
        let workers = self.workers.lock().await;
        workers.values().cloned().collect()
    }
}

fn get_sidecar_path() -> Result<String, String> {
    // TODO: Implement proper sidecar path resolution
    // For now, return placeholder
    #[cfg(windows)]
    return Ok("sidecars/camera-edge.exe".to_string());

    #[cfg(not(windows))]
    return Ok("sidecars/camera-edge".to_string());
}

fn handle_ipc_event(event: IPCEvent) {
    match event {
        IPCEvent::StreamConnected {
            camera_id,
            width,
            height,
            fps,
            codec,
            at,
        } => {
            println!(
                "Camera {} connected: {}x{} @ {} fps ({})",
                camera_id, width, height, fps, codec
            );
            // TODO: Update camera health in backend
        }
        IPCEvent::StreamError {
            camera_id,
            code,
            message,
            at,
        } => {
            eprintln!("Camera {} error [{}]: {}", camera_id, code, message);
            // TODO: Report error to backend
        }
        IPCEvent::FrameObserved {
            camera_id,
            frame_number,
            at,
        } => {
            println!("Camera {} frame #{} at {}", camera_id, frame_number, at);
            // TODO: Update last_frame_at in health tracking
        }
        IPCEvent::QueueDepth {
            camera_id,
            depth,
            at,
        } => {
            println!("Camera {} queue depth: {}", camera_id, depth);
            // TODO: Update queue depth metric
        }
        IPCEvent::WorkerReady {
            camera_id,
            config_revision,
            at,
        } => {
            println!(
                "Worker {} ready with config revision {}",
                camera_id, config_revision
            );
            // TODO: Mark worker as running
        }
    }
}

// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod config;
mod supervisor;
mod health;

use tauri::{SystemTray, SystemTrayMenu, SystemTrayMenuItem, Manager};

fn main() {
    let tray_menu = SystemTrayMenu::new()
        .add_item(tauri::CustomMenuItem::new("show".to_string(), "Show Dashboard"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(tauri::CustomMenuItem::new("quit".to_string(), "Quit"));

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            tauri::SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "show" => {
                    let window = app.get_window("main").unwrap();
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
                "quit" => {
                    std::process::exit(0);
                }
                _ => {}
            },
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            auth::commands::enroll_agent,
            auth::commands::check_credentials,
            config::commands::get_config,
            config::commands::sync_config,
            health::commands::get_agent_status,
            health::commands::get_camera_health,
            supervisor::commands::start_camera,
            supervisor::commands::stop_camera,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

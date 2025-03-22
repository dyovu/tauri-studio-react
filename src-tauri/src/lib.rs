use std::sync::{Arc, Mutex};
// use tauri::command;
use tauri::Manager;

mod recording;
mod detect_device;
mod screenshot;
use recording::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();
            app.manage(app_handle.clone());
            let _ = detect_device::detect_device();
            Ok(())
        })
        .manage(Arc::new(AppState {
            listener_process: Mutex::new(None),
            recording_process: Mutex::new(None),
        }))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![recording::start_recording, recording::stop_recording, screenshot::take_screenshot])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
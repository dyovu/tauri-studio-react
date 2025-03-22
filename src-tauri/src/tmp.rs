use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::sync::{Arc, Mutex};
use tauri::Manager;
use chrono::Local;
use std::env;
use dotenv;

use crate::detect_device;
use detect_device::get_display_num;

pub struct AppState {
    pub listener_process: Mutex<Option<std::process::Child>>, // マウス位置取得プロセス
    pub recording_process: Mutex<Option<std::process::Child>>, // 画面録画プロセス
}

#[tauri::command]
pub fn start_recording(app_handle: tauri::AppHandle) -> Result<String, String> {
    dotenv::dotenv().ok();
    let display_num = get_display_num().unwrap_or("0".to_string());
    println!("display_num: {:?}", display_num);

    let output_dir = "/tmp";
    let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let output_path = format!("{}/{}.mp4", output_dir, timestamp);
    println!("output_path: {}", output_path);

    let listener_path = "bin/get-mouse-position";

    let ffmpeg_path = if cfg!(target_os = "windows") {
        "src-tauri/bin/ffmpeg.exe"
    } else {
        "bin/ffmpeg"
    };
    println!("ffmpeg_path: {}", ffmpeg_path);

    let mut args = vec![
        "-f",
        if cfg!(target_os = "macos") { "avfoundation" } else { "gdigrab" },
        "-framerate", "30",
        "-i",
        if cfg!(target_os = "macos") { &display_num } else { "desktop" },
        "-c:v", "libx264",
        "-preset", "fast",
        "-vf", "format=yuv420p",
        "-movflags", "+faststart",
        &output_path,
    ];
    if cfg!(target_os = "macos") {
        args.extend(["-pixel_format", "uyvy422"]);
    }

    let mut child = Command::new(listener_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start listener: {}", e))?;

    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        std::thread::spawn(move || {
            for line in reader.lines() {
                if let Ok(line) = line {
                    println!("Received from listener: {}", line);
                    /*
                     ここで受け取ったpositionと時間をglobalの配列に入れる
                    */
                }
            }
        });
    }
    // プロセスをapp_stateに格納
    let state = app_handle.state::<Arc<AppState>>();
    {
        let mut guard = state.listener_process.lock().unwrap();
        *guard = Some(child);
    }

    
    let mut command = Command::new(ffmpeg_path);
    command.args(&args);
    command.stdin(Stdio::piped());
    match command.spawn() {
        Ok(child) => {
            let app_state = app_handle.state::<Arc<AppState>>();
            let mut process = app_state.recording_process.lock().unwrap();
            *process = Some(child);
            println!("Recording started, output path: {}", output_path.to_string());
            Ok(output_path.to_string())
        }
        Err(e) => Err(format!("Failed to start recording: {}", e)),
    }
}

#[tauri::command]
pub fn stop_recording(app_handle: tauri::AppHandle) -> Result<String, String> {
    let state = app_handle.state::<Arc<AppState>>();
    if let Some(mut listener_process) = state.listener_process.lock().unwrap().take() {
        listener_process.kill().map_err(|e| format!("Failed to stop listener: {}", e))?;
        // println!("Listener stopped successfully");
    }

    let app_state = app_handle.state::<Arc<AppState>>();
    let mut process = app_state.recording_process.lock().unwrap();
    if let Some(mut child) = process.take() {
        if let Some(ref mut stdin) = child.stdin {
            use std::io::Write;
            if let Err(e) = stdin.write_all(b"q") {
                return Err(format!("Failed to send quit command: {}", e));
            }
        }
        match child.wait() {
            Ok(_) => {
                println!("Recording stopped successfully");
                return Ok("Recording stopped".to_string())
            }
            Err(e) => return Err(format!("Failed to stop recording: {}", e)),
        }
    } else {
        return Err("No recording process found".to_string())
    }
}


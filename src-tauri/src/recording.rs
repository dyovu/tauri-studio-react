use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
// use tauri::command;
use chrono::Local;
use dotenv;
use once_cell::sync::Lazy;
use serde::Serialize;
use std::env;
use tauri::Manager;

use crate::transform_cordinate;
use transform_cordinate::transform_cordinate;
use crate::detect_device;
use detect_device::get_display_num;


pub struct AppState {
    pub listener_process: Mutex<Option<std::process::Child>>, // マウス位置取得プロセス
    pub recording_process: Mutex<Option<std::process::Child>>, // 画面録画プロセス
}

#[derive(Serialize, Debug, Clone)]
pub struct ClickRecord {
    pub timing: f32,
    pub point: [f32; 2],
}

static CLICK_RECORDS: Lazy<Mutex<Vec<ClickRecord>>> = Lazy::new(|| Mutex::new(Vec::new()));

#[tauri::command]
pub fn start_recording(app_handle: tauri::AppHandle) -> Result<String, String> {
    // click_recordsを初期化
    let mut click_records = CLICK_RECORDS.lock().unwrap();
    click_records.clear();
    dotenv::dotenv().ok();
    // let input_device_id = env::var("INPUT_DEVICE_ID").unwrap_or("0".to_string());
    let display_num = get_display_num().unwrap_or("0".to_string());
    println!("display_num: {:?}", display_num);

    let output_dir = "/tmp";
    let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let output_path = format!("{}/{}.mp4", output_dir, timestamp);
    println!("output_path: {}", output_path);

    // let mut current_dir = env::current_dir().expect("Failed to get current dir");
    // println!("current_dir: {:?}", current_dir);

    let ffmpeg_path = if cfg!(target_os = "windows") {
        "src-tauri/bin/ffmpeg.exe"
    } else {
        "bin/ffmpeg"
    };
    println!("ffmpeg_path: {}", ffmpeg_path);

    let mut args = vec![
        "-f",
        if cfg!(target_os = "macos") {
            "avfoundation"
        } else {
            "gdigrab"
        },
        "-framerate",
        "30",
        "-i",
        if cfg!(target_os = "macos") {
            &display_num
        } else {
            "desktop"
        },
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-vf",
        "format=yuv420p",
        "-movflags",
        "+faststart",
        &output_path,
    ];
    if cfg!(target_os = "macos") {
        args.extend(["-pixel_format", "uyvy422"]);
    }

    let listener_path = "bin/get-mouse-position";
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
                    943.59375, 418.79297, 4.047246501.90 bitrate=1104.0kbits/s speed=0.539x
                    */
                    let info_vec = line
                        .split(",")
                        .map(|s| s.trim().to_string())
                        .collect::<Vec<String>>();
                    // println!("info_vec: {:?}", info_vec);
                    let(x, y) = transform_cordinate(info_vec[0].parse::<f32>().unwrap(), info_vec[1].parse::<f32>().unwrap(),); 
                    let click_record = ClickRecord {
                        timing: info_vec[2].parse::<f32>().unwrap(),
                        point: [x, y]
                    };
                    let mut click_records = CLICK_RECORDS.lock().unwrap();
                    click_records.push(click_record);
                    // println!("click_records: {:?}", click_records);
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
    command.stdin(Stdio::piped()); // 正常終了させるためにstdinのパイプも有効にする, 停止するために qを入力するから
    match command.spawn() {
        Ok(child) => {
            // プロセスをapp_stateに格納
            let app_state = app_handle.state::<Arc<AppState>>(); // アプリケーションのグローバルな状態を取得
            let mut process = app_state.recording_process.lock().unwrap(); // Mutexをロックして他のスレッドからアクセスできないようにし、起動したプロセスを格納
            *process = Some(child);
            println!(
                "Recording started, output path: {}",
                output_path.to_string()
            );
            Ok(output_path.to_string())
        }
        Err(e) => Err(format!("Failed to start recording: {}", e)),
    }
}


#[tauri::command]
pub fn stop_recording(app_handle: tauri::AppHandle) -> Result<Vec<ClickRecord>, String> {
    let state = app_handle.state::<Arc<AppState>>();
    if let Some(mut listener_process) = state.listener_process.lock().unwrap().take() {
        listener_process
            .kill()
            .map_err(|e| format!("Failed to stop listener: {}", e))?;
        // println!("Listener stopped successfully");
    }

    let app_state = app_handle.state::<Arc<AppState>>();
    let mut process = app_state.recording_process.lock().unwrap();
    if let Some(mut child) = process.take() {
        // 正常終了のため、ffmpegに"q"を送信する
        if let Some(ref mut stdin) = child.stdin {
            use std::io::Write;
            if let Err(e) = stdin.write_all(b"q") {
                return Err(format!("Failed to send quit command: {}", e));
            }
        }
        // プロセスが終了するのを待機する
        match child.wait() {
            Ok(_) => {
                println!("Recording stopped successfully");
                // CLICK_RECORDSをそのまま返す
                let click_records = CLICK_RECORDS.lock().unwrap();
                Ok(click_records.clone())
            }
            Err(e) => Err(format!("Failed to stop recording: {}", e)),
        }
    } else {
        Err("No recording process found".to_string())
    }
}

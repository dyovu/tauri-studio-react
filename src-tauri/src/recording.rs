use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
// use tauri::command;
use tauri::Manager;
use chrono::Local;
use std::env;
use dotenv;

use crate::detect_device;
use detect_device::get_display_num;
use crate::get_mouse_position::listen_mouse_click;

#[tauri::command]
pub fn start_recording(app_handle: tauri::AppHandle) -> Result<String, String> {
    dotenv::dotenv().ok();
    // let input_device_id = env::var("INPUT_DEVICE_ID").unwrap_or("0".to_string());
    let display_num = get_display_num().unwrap_or("0".to_string());
    println!("display_num: {:?}", display_num);

    let output_dir = "/tmp"; // {HD}/private/tmp/
    // let output_dir = "./src/tmp";
    let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let output_path = format!("{}/{}.mp4", output_dir, timestamp);
    println!("output_path: {}", output_path);

    // let mut current_dir = env::current_dir().expect("Failed to get current dir");
    // println!("current_dir: {:?}", current_dir);

    let ffmpeg_path = if cfg!(target_os = "windows") {
        "src-tauri/bin/ffmpeg.exe"
    } else {
        "bin/ffmpeg"
    }; // FFmpeg バイナリのパス
    println!("ffmpeg_path: {}", ffmpeg_path);

    let mut args = vec![ // 引数の設定
        "-f",
        if cfg!(target_os = "macos") { "avfoundation" } else { "gdigrab" },
        "-framerate", "30",
        "-i",
        if cfg!(target_os = "macos") { &display_num } else { "desktop" },
        "-c:v", "libx264",
        "-preset", "fast",
        "-vf", "format=yuv420p", // 出力をyuv420pに変換
        "-movflags", "+faststart",
        &output_path,
    ];
    if cfg!(target_os = "macos") {
        args.extend(["-pixel_format", "uyvy422"]); // macOS用ピクセルフォーマット
    }

    let mut command = Command::new(ffmpeg_path);
    command.args(&args);
    // 正常終了させるためにstdinのパイプも有効にする, 停止するために qを入力するから
    command.stdin(Stdio::piped());


    // // マウスクリック情報を保存する配列を作成
    // let mouse_events = Arc::new(Mutex::new(Vec::new()));
    // // マウスイベントを監視
    // {
    //     let mouse_events = Arc::clone(&mouse_events);
    //     listen_mouse_click(move |position, timestamp| {
    //         let mut events = mouse_events.lock().unwrap();
    //         events.push((position, timestamp.clone()));
    //         println!("Mouse clicked at {:?} at {}", position, timestamp);
    //     }).expect("Failed to start mouse listener");
        
    // }
    

    match command.spawn() {
        Ok(child) => { // プロセスをapp_stateに格納
            let app_state = app_handle.state::<Arc<Mutex<Option<std::process::Child>>>>(); // アプリケーションのグローバルな状態を取得
            let mut process = app_state.lock().unwrap(); // Mutexをロックして他のスレッドからアクセスできないようにし、起動したプロセスを格納
            *process = Some(child);
            println!("Recording started, output path: {}", output_path.to_string());
            Ok(output_path.to_string())
        }
        Err(e) => Err(format!("Failed to start recording: {}", e)),
    }
}


#[tauri::command]
pub fn stop_recording(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_state = app_handle.state::<Arc<Mutex<Option<std::process::Child>>>>();
    let mut process = app_state.lock().unwrap();
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
                Ok("Recording stopped".to_string())
            }
            Err(e) => Err(format!("Failed to stop recording: {}", e)),
        }
    } else {
        Err("No recording process found".to_string())
    }
}

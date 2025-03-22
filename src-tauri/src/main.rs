// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
fn take_screenshot() -> Result<String, String> {
    // HOME 環境変数からユーザーのホームディレクトリを取得し、Downloads フォルダを指定
    let home_dir = std::env::var("HOME").map_err(|e| e.to_string())?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let file_name = format!("screenshot_{}.png", timestamp);
    let output_path = PathBuf::from(home_dir).join("Downloads").join(file_name);
    let output_str = output_path
        .to_str()
        .ok_or("出力パスの変換に失敗")?
        .to_string();

    // macOS の screencapture コマンドを利用
    // -x オプションでキャプチャ時のサウンドやアニメーションを無効化
    let status = Command::new("screencapture")
        .args(&["-x", output_str.as_str()])
        .status()
        .map_err(|e| e.to_string())?;

    if !status.success() {
        return Err("screencapture コマンドが失敗しました".into());
    }

    println!("スクリーンショット保存先: {}", output_str);
    Ok(output_str)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![take_screenshot])
        .run(tauri::generate_context!())
        .expect("Tauri アプリの実行中にエラーが発生しました");
}

use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::fs;
use std::path::Path;
use tauri::command;
use once_cell::sync::OnceCell;

static DISPLAY_NUM: OnceCell<Mutex<Option<String>>> = OnceCell::new();


// ffmpegで使用できるデバイスを検出する
// アプリの起動時にdetect_device()を実行し出力結果を .jsonに格納する
#[tauri::command]
pub fn detect_device() -> Result<String, String> {
    /*
     このプロジェクト外パスにしないとリロードされてしまう、監視対象外の位置を探す
    */
    let path = Path::new("./device.conf.json");

    let ffmpeg_path = if cfg!(target_os = "windows") {
        "src-tauri/bin/ffmpeg.exe"
    } else {
        "bin/ffmpeg"
    };

    let output = Command::new(ffmpeg_path)
        .args(&["-f", "avfoundation", "-list_devices", "true", "-i", "dummy"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped()) // stderrをキャプチャ (このコマンドの出力はの出力はstderrに書き出される)
        .spawn() 
        .map_err(|e| format!("Failed to execute ffmpeg: {}", e))? 
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for ffmpeg: {}", e))?;

    // output.stderrのバイナリをStringに変換しJsonに格納する
    let result = String::from_utf8(output.stderr)
        .map_err(|e| format!("Failed to convert stderr to string: {}", e))?;


    let display_num: Option<String> = process_avfoundation_devices(result)?;
    *DISPLAY_NUM.get_or_init(|| Mutex::new(None)).lock().unwrap() = display_num.clone();
    // println!("display_num: {:?}", display_num);
    Ok("Writing device conf coompletely".to_string())
}

pub fn get_display_num() -> Option<String> {
    DISPLAY_NUM.get()
        .and_then(|mutex| mutex.lock().unwrap().clone())
}

pub fn process_avfoundation_devices(result: String) -> Result<Option<String>, String> {
    let video_devices_marker = "AVFoundation video devices:";
    let audio_devices_marker = "AVFoundation audio devices:";
    let mut display_number: Option<String> = None;

    // Find the section containing video devices
    let video_section = result
        .split(video_devices_marker)
        .nth(1)
        .ok_or("Failed to find video devices section")?;

    // println!("video_section: {:?}", video_section);

    let mut video_device = Vec::new();
    let mut audio_device = Vec::new();

    let mut flag:bool = false;
    for line in video_section.lines(){
        if line.trim().is_empty() {
            continue;
        }

        if line.contains(audio_devices_marker){
            flag = true;
        }else if flag{
            audio_device.push(line);
        }else{
            video_device.push(line);
        }
    }
    
    let mut video_devices = serde_json::Map::new();
    for line in video_device {
        let second_head_quote = line.rfind("[").ok_or("Failed to find first head quote")?;
        let second_end_quote = line.rfind("]").ok_or("Failed to find first head quote")?;
        let value: &str = &line[second_head_quote+1..second_end_quote].trim();
        let key: &str = &line[second_end_quote+1..].trim();
        video_devices.insert(key.to_string(), serde_json::Value::String(value.to_string()));

        if key == "Capture screen 0" {
            display_number = Some(value.to_string()); 
            // println!("display_number: {:?}", display_number);
        }
    }
    println!("video_devices: {:?}", video_devices);
    println!("display_number: {:?}", display_number);

    Ok(display_number)
}

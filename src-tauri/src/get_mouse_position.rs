// use chrono::Local;
// use std::sync::{Arc, Mutex};
// use std::thread::{self, JoinHandle};
// use std::time::Instant;
// use tauri::Manager;
// use serde::Serialize;
// use rdev::{listen, Event, EventType, Button};
// use once_cell::sync::Lazy;

// #[derive(Serialize, Debug, Clone)]
// pub struct ClickRecord {
//     timing: f32,
//     point: [f32; 2],
// }

// static CLICK_RECORDS: Lazy<Arc<Mutex<Vec<ClickRecord>>>> = Lazy::new(|| {
//     Arc::new(Mutex::new(Vec::new()))
// });

// static RUNNING: Lazy<Arc<Mutex<bool>>> = Lazy::new(|| {
//     Arc::new(Mutex::new(true)) // スレッドの実行状態を管理
// });

// static MOUSE_THREAD: Lazy<Mutex<Option<JoinHandle<()>>>> = Lazy::new(|| Mutex::new(None));

// /// マウスクリックのイベントをリッスンして、位置と時間を取得するぞ
// pub fn listen_mouse_click(app_handle: tauri::AppHandle) {
//     let records_clone = CLICK_RECORDS.clone();
//     let last_position = Arc::new(Mutex::new((0.0, 0.0)));  // ローカル変数として定義
//     let position_clone = last_position.clone();
//     let running_clone = RUNNING.clone();
//     let start_time = Instant::now();

//     let handle = thread::spawn(move || {
//         if !*running_clone.lock().unwrap() {
//             println!("Thread is stopped"); 
//             return;
//         }

//         if let Err(error) = listen(move |event| {
//             match event.event_type {
//                 EventType::MouseMove { x, y } => {
//                     let mut pos = position_clone.lock().unwrap();
//                     *pos = (x as f32, y as f32);
//                 }
//                 EventType::ButtonPress(button) => {
//                     if button == Button::Left {
//                         let pos = position_clone.lock().unwrap();
//                         let elapsed = start_time.elapsed().as_secs_f32();
//                         println!(
//                             "Mouse clicked at ({}, {}) after {}s",
//                             pos.0, pos.1, elapsed
//                         );

//                         let record = ClickRecord {
//                             timing: elapsed,
//                             point: [pos.0, pos.1],
//                         };
//                         records_clone.lock().unwrap().push(record);
//                     }
//                 }
//                 _ => {}
//             }
//         }) {
//             eprintln!("Error listening to mouse events: {:?}", error);
//         }
//     });

//     // スレッドハンドルをグローバルに保持
//     let mut mouse_thread = MOUSE_THREAD.lock().unwrap();
//     *mouse_thread = Some(handle);

//     app_handle.manage(CLICK_RECORDS.clone());
// }



// /// スレッドを停止し、記録を取得する関数
// pub fn stop_listen_mouse_click() -> Vec<ClickRecord> {
//     {
//         let mut running = RUNNING.lock().unwrap();
//         *running = false;
//     }

//     // スレッドを停止
//     if let Some(handle) = MOUSE_THREAD.lock().unwrap().take() {
//         // スレッドが正常に終了するまで待つ
//         if let Err(err) = handle.join() {
//             eprintln!("Error while joining the thread: {:?}", err);
//         }
//     }

//     let records = CLICK_RECORDS.lock().unwrap().clone();
//     println!("Recorded Clicks: {:?}", records);
//     // 記録をクリア
//     CLICK_RECORDS.lock().unwrap().clear();

//     records
// }

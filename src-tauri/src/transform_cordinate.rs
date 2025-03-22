use rdev::display_size;

pub fn transform_cordinate(x: f32, y: f32) -> (f32, f32) {
    let (canvas_width, canvas_height) = (800.0, 500.0);
    let (screen_width, screen_height) = display_size().unwrap();
    let x = x * canvas_width / (screen_width as f32);
    let y = y * canvas_height / (screen_height as f32);
    println!("x: {}, y: {}", x, y);
    (x, y)
}

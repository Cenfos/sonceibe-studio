#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // No native commands or remote IPC permissions are exposed to the website.
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar SonCeibe Studio");
}

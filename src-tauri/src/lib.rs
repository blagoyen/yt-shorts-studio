mod commands;
pub mod error;
pub mod models;
pub mod services;
mod state;

use tauri::Manager;

use crate::commands::media_commands::{generate_thumbnail, generate_waveform, probe_media};
use crate::commands::project_commands::{
    list_recent_projects, load_project, remove_recent_project, save_project,
};
use crate::commands::render_commands::{cancel_render, start_render};
use crate::commands::transcription_commands::{
    cancel_transcription, check_whisper_model, download_whisper_model, transcribe_media,
};
use crate::commands::system_commands::{
    check_dependencies, get_app_info, get_settings, list_media_in_folder, media_exists,
    update_settings,
};
use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = AppState::load(app.handle());
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            update_settings,
            get_app_info,
            check_dependencies,
            media_exists,
            list_media_in_folder,
            probe_media,
            generate_thumbnail,
            generate_waveform,
            save_project,
            load_project,
            list_recent_projects,
            remove_recent_project,
            start_render,
            cancel_render,
            transcribe_media,
            cancel_transcription,
            download_whisper_model,
            check_whisper_model,
        ])
        .run(tauri::generate_context!())
        .expect("error while running YT Shorts Studio");
}

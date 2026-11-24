use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionWord {
    pub text: String,
    pub start_ms: u64,
    pub end_ms: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionResult {
    #[serde(default)]
    pub language: String,
    #[serde(default)]
    pub duration_ms: u64,
    #[serde(default)]
    pub words: Vec<TranscriptionWord>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionProgressEvent {
    pub job_id: String,
    pub progress: f64,
    pub stage: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionCompleteEvent {
    pub job_id: String,
    pub success: bool,
    pub cancelled: bool,
    pub error: Option<String>,
    pub result: Option<TranscriptionResult>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelDownloadProgressEvent {
    pub model: String,
    pub progress: f64,
    pub stage: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelDownloadCompleteEvent {
    pub model: String,
    pub success: bool,
    pub error: Option<String>,
}

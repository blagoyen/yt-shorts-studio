use std::path::Path;
use std::time::Duration;

use tokio::process::Command;
use tokio::time::timeout;

use crate::error::{CmdResult, CommandError};

pub struct CapturedOutput {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

/// Run an external executable and capture its output, with a hard timeout.
pub async fn run_capture(
    program: &Path,
    args: &[String],
    limit: Duration,
) -> CmdResult<CapturedOutput> {
    let future = Command::new(program).args(args).output();
    let output = timeout(limit, future)
        .await
        .map_err(|_| CommandError::new("PROCESS_TIMEOUT", "The process timed out."))?
        .map_err(|err| CommandError::new("PROCESS_FAILED", err.to_string()))?;

    Ok(CapturedOutput {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

/// Run an executable that writes its result directly to `output_path`.
pub async fn run_ffmpeg(program: &Path, args: &[String]) -> CmdResult<CapturedOutput> {
    let output = Command::new(program)
        .args(args)
        .output()
        .await
        .map_err(|err| CommandError::new("PROCESS_FAILED", err.to_string()))?;

    if output.status.success() {
        Ok(CapturedOutput {
            success: true,
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        })
    } else {
        Err(CommandError::new(
            "FFMPEG_FAILED",
            "FFmpeg could not complete the operation.",
        )
        .with_detail(String::from_utf8_lossy(&output.stderr).trim().to_string()))
    }
}

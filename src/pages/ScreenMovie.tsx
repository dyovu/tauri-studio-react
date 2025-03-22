import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { useState, useRef } from "react";

export default function ScreenMovie() {
  const [isRecording, setIsRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>();
  const filepath = useRef<string>();

  const startRecording = async () => {
    setIsRecording(true);

    const videoPath = await invoke<string>("start_recording");
    filepath.current = convertFileSrc(await join("/private", videoPath));
  };
  const stopRecording = async () => {
    setIsRecording(false);

    await invoke("stop_recording");
    setVideoUrl(filepath.current);
  };

  return (
    <>
      <div>ScreenMovie</div>

      <div className="grid place-items-center h-screen">
        {!isRecording && (
          <button
            onClick={startRecording}
            className="text-4xl bg-slate-400 p-3 rounded-md"
          >
            Start Recording
          </button>
        )}
        {isRecording && (
          <button
            onClick={stopRecording}
            className="text-4xl bg-red-400 p-3 rounded-md"
          >
            Stop Recording
          </button>
        )}
      </div>

      {videoUrl && (
        <video src={videoUrl} controls width="800" className="mt-4">
          お使いのブラウザは video タグに対応していません。
        </video>
      )}
    </>
  );
}

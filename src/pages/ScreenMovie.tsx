import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

export default function ScreenMovie() {
    const [isRecording, setIsRecording] = useState(false);

    const startRecording = async () => {
        setIsRecording(true);

        await invoke("start_recording");
    };
    const stopRecording = async () => {
        setIsRecording(false);

        await invoke("stop_recording");
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
        </>
    );
}

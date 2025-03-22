import "./App.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ScreenShot from "./pages/ScreenShot";
import Home from "./pages/Home";
import ScreenMovie from "./pages/ScreenMovie";
import { useState } from "react";

function App() {
    const [isRecording, setIsRecording] = useState(false);

    const startRecording = async () => {
        setIsRecording(true);

        // 録画開始時の処理....
    };
    const stopRecording = async () => {
        setIsRecording(false);

        // 録画終了時の処理....
    };

    return (
        <>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/screen-shot" element={<ScreenShot />} />
                    <Route path="/screen-movie" element={<ScreenMovie />} />
                </Routes>
            </BrowserRouter>

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

export default App;

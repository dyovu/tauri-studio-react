import "./App.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ScreenShot from "./pages/ScreenShot";
import Home from "./pages/Home";
import ScreenMovie from "./pages/ScreenMovie";

function App() {
    return (
        <>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/screen-shot" element={<ScreenShot />} />
                    <Route path="/screen-movie" element={<ScreenMovie />} />
                </Routes>
            </BrowserRouter>
        </>
    );
}

export default App;

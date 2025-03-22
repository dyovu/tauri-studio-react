import "./App.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ScreenShot from "./pages/ScreenShot";
import Home from "./pages/Home";
import ScreenMovie from "./pages/ScreenMovie";
import { ThemeProvider } from "./components/ui/theme-provider";


function App() {

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/screen-shot" element={<ScreenShot />} />
          <Route path="/screen-movie" element={<ScreenMovie />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

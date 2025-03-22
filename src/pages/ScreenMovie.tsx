import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Menu, type MenuItemOptions } from "@tauri-apps/api/menu";
import { join } from "@tauri-apps/api/path";
import { TrayIcon } from "@tauri-apps/api/tray";
import { useState, useRef, useEffect } from "react";
import { Image } from "@tauri-apps/api/image";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { exit, relaunch } from "@tauri-apps/plugin-process";

export default function ScreenMovie() {
  const [isRecording, setIsRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>();
  const filepath = useRef<string>();
  const trayMenu = useRef<Menu>();
  const trayIcon = useRef<TrayIcon>();

  const startRecording = async () => {
    console.log("startRecording");
    setIsRecording(true);

    const videoPath = await invoke<string>("start_recording");
    filepath.current = convertFileSrc(await join("/private", videoPath));
  };
  const stopRecording = async () => {
    console.log("stopRecording");
    setIsRecording(false);

    await invoke("stop_recording");
    setVideoUrl(filepath.current);
  };

  const setupTray = async () => {
    trayMenu.current = await Menu.new({
      items: [
        {
          id: "record",
          text: "Start Recording",
          action: async () => {
            if (!isRecording) {
              await startRecording();
            } else {
              await stopRecording();
            }
          },
        } as MenuItemOptions,
        {
          id: "quit",
          text: "Quit",
          action: async () => {
            await exit();
          },
        } as MenuItemOptions,
        {
          id: "restart",
          text: "Restart",
          action: async () => {
            await relaunch();
          },
        } as MenuItemOptions,
      ],
    });

    trayIcon.current = await TrayIcon.new({
      icon: (await defaultWindowIcon()) as Image,
      menu: trayMenu.current,
      menuOnLeftClick: true,
    });
  };

  const updateTrayMenu = async () => {
    if (!trayMenu.current || !trayIcon.current) return;

    const newMenu = await Menu.new({
      items: [
        {
          id: "record",
          text: isRecording ? "Stop Recording" : "Start Recording",
          action: async () => {
            if (!isRecording) {
              await startRecording();
            } else {
              await stopRecording();
            }
          },
        } as MenuItemOptions,
        {
          id: "quit",
          text: "Quit",
          action: async () => {
            await exit();
          },
        } as MenuItemOptions,
        {
          id: "restart",
          text: "Restart",
          action: async () => {
            await relaunch();
          },
        } as MenuItemOptions,
      ],
    });

    await trayIcon.current.setMenu(newMenu);
  };

  useEffect(() => {
    setupTray();
  }, []);

  useEffect(() => {
    updateTrayMenu();
  }, [isRecording]);

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

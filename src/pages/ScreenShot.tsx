import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';
import { TrayIcon } from '@tauri-apps/api/tray';
import { defaultWindowIcon } from '@tauri-apps/api/app';
import { Image as ImageType } from '@tauri-apps/api/image';
import { Menu } from '@tauri-apps/api/menu';
import { Canvas, FabricImage, Image, PencilBrush, Shadow } from 'fabric';
import { open, BaseDirectory } from '@tauri-apps/plugin-fs';
import { FaCamera, FaDownload, FaEraser, FaHourglassStart, FaPen } from 'react-icons/fa';
import { EraserBrush } from '@erase2d/fabric';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function App() {
  const [_screenshotPath, setScreenshotPath] = useState('');
  const [imageSrc, setImageSrc] = useState('');
  const canvasRef = useRef<Canvas | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [topImage, setTopImage] = useState<Image | null>(null);
  const [bgImage, setBgImage] = useState<Image | null>(null);
  // モードは "default"（選択/移動）, "pen"（ペン描画）, "eraser"（消しゴム描画）
  const [mode, setMode] = useState<'default' | 'pen' | 'eraser'>('default');
  const backGroundList = ["/mac.jpg", "/mac2.jpg", "/mac3.jpg", "/mac4.jpg"];
  const [currentColor, setCurrentColor] = useState("#000000");
  // 消しゴムサイズの state
  const [eraserSize, setEraserSize] = useState(20);
  // ペンの太さの state（初期値10）
  const [penSize, setPenSize] = useState(10);

  // ペンと消しゴムそれぞれのPopoverのopen状態を管理
  const [openPen, setOpenPen] = useState(false);
  const [openEraser, setOpenEraser] = useState(false);

  useEffect(() => {
    async function setupTray() {
      const menu = await Menu.new({
        items: [
          {
            id: "screenshot",
            text: "スクショを撮る",
            action: takeScreenshot
          },
        ],
      });

      const options = {
        icon: (await defaultWindowIcon()) as ImageType,
        menu,
        menuOnLeftClick: true,
      };

      await TrayIcon.new(options);
    }
    setupTray();
  }, []);

  useEffect(() => {
    async function setUpCanvas() {
      if (!canvasElRef.current) return;
      const canvas = new Canvas(canvasElRef.current, {
        width: 800,
        height: 500,
        backgroundColor: "#ffffff"
      });
      // 初期は選択（移動）モードなので描画モードは無効
      canvas.isDrawingMode = false;
      canvasRef.current = canvas;

      const bgImg = await FabricImage.fromURL("/mac.jpg");
      bgImg.scaleToWidth(800);
      bgImg.scaleToHeight(500);
      bgImg.set({
        selectable: false,
        evented: false,
        erasable: false,
      });
      setBgImage(bgImg);
      canvas.set("backgroundImage", bgImg);
      canvas.renderAll();

      // 初期設定としてペン描画用のPencilBrushを作成
      const pencil = new PencilBrush(canvas);
      pencil.color = "#000000";
      pencil.width = penSize; // 初期のペンの太さを反映
      canvas.freeDrawingBrush = pencil;

      // 新規追加されるオブジェクトは、erasable プロパティが未定義の場合のみ true を設定
      canvas.on("object:added", (e) => {
        if (e.target && typeof e.target.erasable === 'undefined') {
          e.target.erasable = true;
        }
      });

      return () => {
        canvas.dispose();
      };
    }
    setUpCanvas();
  }, []);

  useEffect(() => {
    async function screenShotImageSetUp() {
      if (!canvasElRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas || !imageSrc) return;

      const img = await FabricImage.fromURL(imageSrc);
      const targetWidth = 700;
      img.scaleToWidth(targetWidth);
      const targetHeight = img.getScaledHeight();

      img.set({
        left: (canvas.width - targetWidth) / 2,
        top: (canvas.height - targetHeight) / 2,
        erasable: false,
        shadow: new Shadow({
          color: 'rgba(0,0,0,0.3)',
          blur: 10,
          offsetX: 10,
          offsetY: 10
        }),
        isScreenshot: true,
        stroke: 'rgba(255,255,255,0.4)',
        strokeWidth: 2,
        strokeUniform: true,
      });

      canvas.add(img);
      setTopImage(img);
      canvas.renderAll();

      return () => {
        canvas.dispose();
      };
    }
    screenShotImageSetUp();
  }, [imageSrc]);

  const takeScreenshot = async () => {
    try {
      const path = await invoke<string>('take_screenshot');
      setScreenshotPath(path);

      const data = await readFile(path);
      const base64String = uint8ToBase64(data);
      setImageSrc(`data:image/png;base64,${base64String}`);
    } catch (error) {
      console.error('スクリーンショット取得エラー:', error);
    }
  };

  const handleDownload = async () => {
    if (!canvasElRef.current) return;
    canvasRef.current?.discardActiveObject();
    canvasRef.current?.requestRenderAll();

    canvasElRef.current.toBlob(async (blob) => {
      if (!blob) return;
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const fileName = `${crypto.randomUUID()}.png`;
      const file = await open(fileName, {
        write: true,
        createNew: true,
        baseDir: BaseDirectory.Download,
      });
      await file.write(uint8Array);
      await file.close();
    });
  };

  // ペンモードへの切り替え／解除
  const togglePenMode = () => {
    if (!canvasRef.current) return;
    // もし消しゴムのPopoverが開いていたら閉じる
    if (openEraser) setOpenEraser(false);
    setOpenPen((prev) => !prev);
    const canvas = canvasRef.current;
    if (mode !== 'pen') {
      canvas.isDrawingMode = true;
      const pencil = new PencilBrush(canvas);
      pencil.color = currentColor;
      pencil.width = penSize;
      canvas.freeDrawingBrush = pencil;
      setMode('pen');
    } else {
      canvas.isDrawingMode = false;
      setMode('default');
    }
  };

  // 消しゴムモードへの切り替え／解除
  const toggleEraserMode = () => {
    if (!canvasRef.current) return;
    // もしペンのPopoverが開いていたら閉じる
    if (openPen) setOpenPen(false);
    const canvas = canvasRef.current;
    if (mode !== 'eraser') {
      canvas.isDrawingMode = true;
      const eraser = new EraserBrush(canvas);
      eraser.width = eraserSize;
      canvas.freeDrawingBrush = eraser;
      setMode('eraser');
    } else {
      canvas.isDrawingMode = false;
      setMode('default');
    }
    // 消しゴムのPopoverの状態もトグル
    setOpenEraser((prev) => !prev);
  };

  // currentColor の変更時に、すでにペンモードなら freeDrawingBrush の色を更新する
  useEffect(() => {
    if (canvasRef.current?.freeDrawingBrush && mode === "pen") {
      canvasRef.current.freeDrawingBrush.color = currentColor;
      canvasRef.current.requestRenderAll();
    }
  }, [currentColor, mode]);

  // eraserSize の変更時に、消しゴムモードなら brush のサイズを更新
  useEffect(() => {
    if (canvasRef.current && mode === 'eraser' && canvasRef.current.freeDrawingBrush instanceof EraserBrush) {
      canvasRef.current.freeDrawingBrush.width = eraserSize;
      canvasRef.current.requestRenderAll();
    }
  }, [eraserSize, mode]);

  // penSize の変更時に、ペンモードなら brush の太さを更新
  useEffect(() => {
    if (canvasRef.current && mode === 'pen' && canvasRef.current.freeDrawingBrush instanceof PencilBrush) {
      canvasRef.current.freeDrawingBrush.width = penSize;
      canvasRef.current.requestRenderAll();
    }
  }, [penSize, mode]);

  const handleImageLoad = async (url: string) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const bgImg = await FabricImage.fromURL(url);
    bgImg.scaleToWidth(800);
    bgImg.scaleToHeight(500);
    bgImg.set({
      selectable: false,
      evented: false,
    });
    if (bgImage) {
      canvas.remove(bgImage);
    }
    canvas.set("backgroundImage", bgImg);
    canvas.renderAll();
    setBgImage(bgImg);
  };

  const backToStartPosition = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    if (topImage) {
      const targetWidth = 700;
      topImage.scaleToWidth(targetWidth);
      const targetHeight = topImage.getScaledHeight();
      topImage.set({
        left: (canvas.width - targetWidth) / 2,
        top: (canvas.height - targetHeight) / 2,
        erasable: false,
      });
    }
    canvas.renderAll();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const activeObject = canvas.getActiveObject();
          if (activeObject) {
            if (activeObject.get("isScreenshot")) {
              return;
            }
            canvas.remove(activeObject);
            canvas.discardActiveObject();
            canvas.requestRenderAll();
          }
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div>
      <h1>スクリーンショットアプリ</h1>
      {!topImage &&
        <Button variant='outline' onClick={takeScreenshot}>
          <FaCamera />
        </Button>
      }

      <div className='flex gap-2'>

        <Button
          onClick={handleDownload}
          variant='outline'
        >
          <FaDownload />
        </Button>

        <Button variant='outline' onClick={backToStartPosition}>
          <FaHourglassStart />
        </Button>

        {/* ペン用Popover */}
        <Popover
          open={openPen}
          onOpenChange={(nextOpen) => {
            // 外クリックでは閉じさせない
            if (!nextOpen && openPen) return;
            setOpenPen(nextOpen);
          }}
        >
          <PopoverTrigger>
            <span>
              <Button
                variant={mode === 'pen' ? "default" : "outline"}
                onClick={togglePenMode}
              >
                <FaPen />
              </Button>
            </span>
          </PopoverTrigger>
          <PopoverContent>
            <input type="color" value={currentColor} onChange={(e) => setCurrentColor(e.target.value)} />
            <div style={{ width: 200, marginTop: 16 }}>
              <Slider
                defaultValue={[penSize]}
                min={0}
                max={100}
                step={1}
                onValueChange={(value) => setPenSize(value[0])}
              />
              <div>ペンの太さ: {penSize}</div>
            </div>
          </PopoverContent>
        </Popover>

        {/* 消しゴム用Popover */}
        <Popover
          open={openEraser}
          onOpenChange={(nextOpen) => {
            // 外クリックでは閉じさせない
            if (!nextOpen && openEraser) return;
            setOpenEraser(nextOpen);
          }}
        >
          <PopoverTrigger
          >
            <span>
              <Button
                onClick={toggleEraserMode}
                variant={mode === 'eraser' ? "default" : "outline"}
              >
                <FaEraser />
              </Button>
            </span>
          </PopoverTrigger>
          <PopoverContent>
            <div style={{ width: 200, marginTop: 16 }}>
              <Slider
                defaultValue={[eraserSize]}
                min={0}
                max={100}
                step={1}
                onValueChange={(value) => setEraserSize(value[0])}
              />
              <div>消しゴムサイズ: {eraserSize}</div>
            </div>
          </PopoverContent>
        </Popover>

      </div>
      <div className="border rounded-lg overflow-hidden mt-4">
        <canvas ref={canvasElRef} id="canvas" />
      </div>
      <div>
        {backGroundList.map((bg) => (
          <button type='button' onClick={() => handleImageLoad(bg)} key={bg}>
            <img src={bg} className='size-[100px] object-cover' alt="background" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;

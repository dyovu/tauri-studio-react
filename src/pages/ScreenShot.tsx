import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';
import { TrayIcon } from '@tauri-apps/api/tray';
import { defaultWindowIcon } from '@tauri-apps/api/app';
import { Image as ImageType } from '@tauri-apps/api/image';
import { Menu, MenuItemOptions } from '@tauri-apps/api/menu';
import { Canvas, FabricImage, Image, PencilBrush, Shadow } from 'fabric';
import { open, BaseDirectory } from '@tauri-apps/plugin-fs';
import { FaArrowLeft, FaCamera, FaDownload, FaEraser, FaHourglassStart, FaPen } from 'react-icons/fa';
import { EraserBrush } from '@erase2d/fabric';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ColorPicker from '@/components/ui/color-picker';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { Link } from 'react-router-dom';

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
  const [mode, setMode] = useState<'default' | 'pen' | 'eraser'>('default');
  const backGroundList = ["/mac.jpg", "/mac2.jpg", "/mac3.jpg", "/mac4.jpg"];
  const backGroundColorList = ["/red.png", "/blue.png", "/yellow.png", "/light-green.png"];
  const [currentColor, setCurrentColor] = useState("#000000");
  const [eraserSize, setEraserSize] = useState(20);
  const [penSize, setPenSize] = useState(10);
  const [openPen, setOpenPen] = useState(false);
  const [openEraser, setOpenEraser] = useState(false);
  const trayMenuRef = useRef<Menu | null>(null);
  const trayIconRef = useRef<TrayIcon | null>(null);

  const takeScreenshot = async () => {
    try {
      const path = await invoke<string>('take_screenshot');
      setScreenshotPath(path);

      const data = await readFile(path);
      const base64String = uint8ToBase64(data);
      setImageSrc(`data:image/png;base64,${base64String}`);
      await updateTrayMenu();
    } catch (error) {
      console.error('スクリーンショット取得エラー:', error);
    }
  }

  const updateTrayMenu = async () => {
    if (!trayMenuRef.current || !trayIconRef.current) return;

    const newMenu = await Menu.new({
      items: [
        {
          id: "export",
          text: "Export",
          action: async () => {
            await handleDownload();
          },
        } as MenuItemOptions
      ],
    });

    await trayIconRef.current.setMenu(newMenu);
  };

  useEffect(() => {
    updateTrayMenu();
  }, [imageSrc]);

  const setupTray = async () => {
    trayMenuRef.current = await Menu.new({
      items: [
        {
          id: "portrait",
          text: "Take a portrait",
          action: async () => {
            await takeScreenshot();
          },
        } as MenuItemOptions,
      ],
    });

    trayIconRef.current = await TrayIcon.new({
      icon: (await defaultWindowIcon()) as ImageType,
      menu: trayMenuRef.current,
      menuOnLeftClick: true,
    });
  }

  useEffect(() => {
    setupTray();
  }, []);

  useEffect(() => {
    async function setUpCanvas() {
      if (!canvasElRef.current) return;

      if (canvasRef.current) {
        canvasRef.current.dispose();
        canvasRef.current = null;
      }

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
        canvasRef.current = null;
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
    }

    screenShotImageSetUp();
  }, [imageSrc]);

  function updateColor(color: string) {
    setCurrentColor(color)
  }

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

  useEffect(() => {
    if (canvasRef.current?.freeDrawingBrush && mode === "pen") {
      canvasRef.current.freeDrawingBrush.color = currentColor;
      canvasRef.current.requestRenderAll();
    }
  }, [currentColor, mode]);

  useEffect(() => {
    if (canvasRef.current && mode === 'eraser' && canvasRef.current.freeDrawingBrush instanceof EraserBrush) {
      canvasRef.current.freeDrawingBrush.width = eraserSize;
      canvasRef.current.requestRenderAll();
    }
  }, [eraserSize, mode]);

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
      {/*header*/}
      <header className='border-b h-[60px]'>
        <div className="px-3 container mx-auto h-full flex items-center justify-between">
          <Button
            variant="outline"
          >
            <Link to="/">
              <FaArrowLeft />
            </Link>
          </Button>
          <ModeToggle />
        </div>
      </header>

      <div className='min-h-[calc(100vh-70px)] pt-5'>
        <div className='flex justify-between  mx-auto max-w-[800px] px-3'>
          <div className='flex items-center gap-2'>

            <Button variant='outline' onClick={backToStartPosition}>
              <FaHourglassStart />
            </Button>
            {/* 
            {!topImage &&
              <Button variant='outline' onClick={takeScreenshot}>
                <FaCamera />
              </Button>
            } */}

            {/* ペン用Popover */}
            <Popover
              open={openPen}
              onOpenChange={(nextOpen) => {
                // 外クリックでは閉じさせない
                if (!nextOpen && openPen) return;
                setOpenPen(nextOpen);
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant={mode === 'pen' ? "default" : "outline"}
                  onClick={togglePenMode}
                >
                  <FaPen />
                </Button>
              </PopoverTrigger>
              <PopoverContent align='start'>
                <div className='px-2 py-2'>
                  <div className='mb-4'>
                    <ColorPicker
                      currentColor={currentColor}
                      updateColor={updateColor}
                    />
                  </div>
                  <Slider
                    defaultValue={[penSize]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(value) => setPenSize(value[0])}
                  />
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
                asChild
              >
                <Button
                  onClick={toggleEraserMode}
                  variant={mode === 'eraser' ? "default" : "outline"}
                >
                  <FaEraser />
                </Button>
              </PopoverTrigger>
              <PopoverContent align='start'>
                <div className='px-2 py-2'>
                  <Slider
                    defaultValue={[eraserSize]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(value) => setEraserSize(value[0])}
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <Button
            onClick={handleDownload}
            variant='outline'
            className='flex gap-3 items-center'
          >
            <FaDownload />
            Export
          </Button>
        </div>


        <div className='max-w-[800px] mx-auto px-3 pt-5'>
          <Tabs defaultValue="image" className='w-[250px]'>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="image">Image</TabsTrigger>
              <TabsTrigger value="color">Color</TabsTrigger>
            </TabsList>
            <TabsContent value="image" className='w-[800px] pt-5 mt-0'>
              <div className='flex gap-3'>
                {backGroundList.map((bg) => (
                  <button type='button' onClick={() => handleImageLoad(bg)} key={bg}>
                    <img src={bg} className='size-[100px] object-cover rounded-xl' alt="background" />
                  </button>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="color" className='w-[800px] pt-5 mt-0'>
              <div className='flex gap-3'>
                {backGroundColorList.map((bg) => (
                  <button type='button' onClick={() => handleImageLoad(bg)} key={bg}>
                    <img src={bg} className='size-[100px] object-cover rounded-xl' alt="background" />
                  </button>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className='pt-5'>
          <div className="rounded-lg overflow-hidden flex justify-center relative">
            {!imageSrc && <div className='bg-[rgba(0,0,0,0.3)] w-[calc(800px-24px)] h-[500px] absolute z-10 flex justify-center items-center'>
              <div>
                <FaCamera size={50} className='mx-auto mb-3' />
                <div className='font-bold'>スクショを撮ってください</div>
              </div>
            </div>}
            <canvas ref={canvasElRef} id="canvas" className='px-3' />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

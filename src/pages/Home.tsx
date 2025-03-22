import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { FaCamera, FaVideo } from "react-icons/fa";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div>
      <header className='border-b h-[60px]'>
        <div className="px-3 container mx-auto h-full flex items-center justify-end">
          <ModeToggle />
        </div>
      </header>
        <div className="h-[300px] flex items-center pt-20 flex-col">
          <h2 className="text-6xl font-bold mb-5">
            Phantom Frame
          </h2>

          <div className="flex justify-center gap-3">
            <Button variant="outline">
              <Link to="/screen-shot" className="text-lg font-semibold flex gap-2 items-center">
                <FaCamera />
                Portrait
              </Link>
            </Button>
            <Button variant="outline">
              <Link to="/screen-movie" className="text-lg font-semibold flex gap-2 items-center">
                <FaVideo />
                Movie
              </Link>
            </Button>
          </div>
        </div>
    </div>
  );
}

import { Link } from "react-router-dom";

export default function Home() {
    return (
        <div>
          <Link to="/screen-shot">スクリーンショット</Link>
          <Link to="/screen-movie">動画撮影</Link>
        </div>
    );
}

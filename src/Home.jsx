import Demo2 from "./components/Demo2";
import {useNavigate } from "react-router-dom";

function Demo2RouterWrapper() {
  const navigate = useNavigate();

  return <Demo2 navigate={navigate} />;
}

export default function Home() {
    return (
        <>
        <div>
            
        </div>
        <div>
            <Demo2RouterWrapper/>
        </div>
            
        </>
    );
}
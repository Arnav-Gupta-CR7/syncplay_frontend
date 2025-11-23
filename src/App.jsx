import Home from './Home';
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";

function Demo2RouterWrapper() {
  const navigate = useNavigate();

  return <Demo2 navigate={navigate} />;
}


function App() {

  return (
    <>
    <BrowserRouter>
      <Home />
    </BrowserRouter>
    </>
  )
}

export default App

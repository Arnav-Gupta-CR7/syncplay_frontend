import Home from './Home';
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";



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

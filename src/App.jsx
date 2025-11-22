import { useState } from 'react'
import Demo1 from './Demo1'
import Demo2 from './components/Demo2'
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";

function Demo2RouterWrapper() {
  const navigate = useNavigate();

  return <Demo2 navigate={navigate} />;
}


function App() {

  return (
    <>
    <BrowserRouter>
      <Demo2RouterWrapper />
    </BrowserRouter>
    </>
  )
}

export default App

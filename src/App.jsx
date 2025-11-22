import { useState } from 'react'
import Demo1 from './Demo1'
import Demo2 from './components/Demo2'
import { BrowserRouter} from "react-router-dom";


function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    <BrowserRouter>
      <Demo2/>
    </BrowserRouter>
    </>
  )
}

export default App

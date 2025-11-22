import { useState } from 'react'
import Demo1 from './Demo1'
import Demo2 from './components/Demo2'


function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <Demo2/>
    </>
  )
}

export default App

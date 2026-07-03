import { useState } from 'react'
import './styles/index.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-secondary-50 flex items-center justify-center">
      <div className="card max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-secondary-900 mb-2">
          Vaulty
        </h1>
        <p className="text-secondary-600 mb-6">
          Financial Management on Stellar
        </p>
        <div className="flex flex-col gap-4">
          <div className="text-4xl font-bold text-primary-600">
            {count}
          </div>
          <div className="flex gap-4 justify-center">
            <button
              className="btn-primary"
              onClick={() => setCount((count) => count + 1)}
            >
              Increment
            </button>
            <button
              className="btn-secondary"
              onClick={() => setCount((count) => count - 1)}
            >
              Decrement
            </button>
          </div>
        </div>
        <p className="mt-6 text-sm text-secondary-500">
          Edit <code className="bg-secondary-100 px-2 py-1 rounded">src/App.tsx</code> to get started
        </p>
      </div>
    </div>
  )
}

export default App

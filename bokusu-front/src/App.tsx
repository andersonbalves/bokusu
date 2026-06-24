import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { PlayerLayout } from './layouts/PlayerLayout'

function Home() { return <h2>Gestão Home</h2> }
function Player() { return <h2 className="font-display">Player Screen</h2> }

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/queue" element={<Home />} />
        </Route>
        <Route element={<PlayerLayout />}>
          <Route path="/player" element={<Player />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

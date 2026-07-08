import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useRef } from 'react'
import { extractHost } from '../../lib/url'

const PALETTE = ['#ff8800', '#e124ff', '#6a19ff', '#ff2188']
const FPS = 30

interface ScreensaverProps {
  appUrl: string
  hideUrl: boolean
}

export function Screensaver({ appUrl, hideUrl }: ScreensaverProps) {
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    let x = 0
    let y = 0
    let dirX = 1
    let dirY = 1
    let colorIndex = 0
    let running = true
    let lastTime = 0

    const step = (time: number) => {
      if (!running) return
      if (lastTime === 0) lastTime = time
      const delta = time - lastTime

      if (delta >= 1000 / FPS) {
        lastTime = time
        if (!box.parentElement) return
        const { clientWidth: sw, clientHeight: sh } = box.parentElement
        if (y + box.clientHeight >= sh || y < 0) {
          dirY *= -1
          colorIndex = (colorIndex + 1) % PALETTE.length
        }
        if (x + box.clientWidth >= sw || x < 0) {
          dirX *= -1
          colorIndex = (colorIndex + 1) % PALETTE.length
        }
        x += dirX
        y += dirY
        box.style.left = `${x}px`
        box.style.top = `${y}px`
        box.style.backgroundColor = PALETTE[colorIndex]
      }
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
    return () => {
      running = false
    }
  }, [])

  return (
    <div data-testid="screensaver" className="absolute inset-0 z-40 bg-black">
      <div ref={boxRef} className="absolute rounded-xl p-4" style={{ left: 0, top: 0, backgroundColor: PALETTE[0] }}>
        {!hideUrl && (
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-lg bg-white p-2">
              <QRCodeSVG value={appUrl} size={96} />
            </div>
            <p className="text-outlined text-sm text-white">{extractHost(appUrl)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

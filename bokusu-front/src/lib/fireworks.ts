interface Particle {
  x: number
  y: number
  angle: number
  speed: number
  radius: number
}

class Firework {
  particles: Particle[]

  constructor(
    x: number,
    y: number,
    private color: string
  ) {
    this.particles = Array.from({ length: 50 }, () => ({
      x,
      y,
      angle: Math.random() * 2 * Math.PI,
      speed: Math.random() * 2 + 1,
      radius: Math.random() * 6 + 3,
    }))
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const particle of this.particles) {
      particle.x += Math.cos(particle.angle) * particle.speed
      particle.y += Math.sin(particle.angle) * particle.speed
      particle.radius *= 0.98
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
      ctx.fillStyle = this.color
      ctx.fill()
    }
  }
}

/** Show de fogos proporcional à nota. Retorna função de cleanup que interrompe o show. */
export function launchFireworkShow(
  canvas: HTMLCanvasElement,
  score: number,
  durationMs = 5000
): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => undefined
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  let simultaneous = 3
  let intensity = 500
  if (score < 30) {
    simultaneous = 1
    intensity = 1300
  } else if (score < 60) {
    simultaneous = 2
    intensity = 800
  }

  const fireworks: Firework[] = []
  let animating = false
  let stopped = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const animate = () => {
    if (stopped) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (let i = fireworks.length - 1; i >= 0; i--) {
      fireworks[i].draw(ctx)
      fireworks[i].particles = fireworks[i].particles.filter((p) => p.radius > 0.5)
      if (fireworks[i].particles.length === 0) fireworks.splice(i, 1)
    }
    if (fireworks.length > 0) requestAnimationFrame(animate)
    else animating = false
  }

  const addFireworks = (count: number) => {
    for (let i = 0; i < count; i++) {
      fireworks.push(
        new Firework(
          Math.random() * canvas.width,
          Math.random() * canvas.height * 0.6,
          `hsl(${Math.random() * 360}, 100%, 60%)`
        )
      )
    }
    if (!animating) {
      animating = true
      requestAnimationFrame(animate)
    }
  }

  const startTime = Date.now()
  const launchInterval = () => {
    if (stopped || Date.now() - startTime > durationMs) return
    addFireworks(Math.floor(Math.random() * simultaneous) + simultaneous)
    timeoutId = setTimeout(launchInterval, Math.random() * intensity + 200)
  }
  launchInterval()

  return () => {
    stopped = true
    if (timeoutId) clearTimeout(timeoutId)
  }
}

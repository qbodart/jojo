import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  viewChild,
  afterNextRender,
} from '@angular/core';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  shape: 'rect' | 'circle';
}

@Component({
  selector: 'app-confetti',
  standalone: true,
  template: `
    <canvas
      #confettiCanvas
      class="fixed inset-0 w-full h-full pointer-events-none"
      style="z-index: 50"
    ></canvas>
  `,
})
export class ConfettiComponent implements OnInit, OnDestroy {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('confettiCanvas');

  private particles: Particle[] = [];
  private animationId: number | null = null;
  private startTime = 0;
  private readonly DURATION = 5000; // 5 seconds
  private readonly PARTICLE_COUNT = 150;

  // App palette colors
  private readonly COLORS = [
    '#ec4899', // pink-500
    '#a855f7', // purple-500
    '#f59e0b', // amber-500
    '#0ea5e9', // sky-500
    '#22c55e', // green-500
    '#f97316', // orange-500
    '#fbbf24', // amber-400
    '#e879f9', // fuchsia-400
  ];

  constructor() {
    afterNextRender(() => {
      this.initCanvas();
      this.createParticles();
      this.startTime = performance.now();
      this.animate();
    });
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
  }

  private initCanvas(): void {
    const canvas = this.canvasRef().nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  private createParticles(): void {
    const canvas = this.canvasRef().nativeElement;
    this.particles = [];

    for (let i = 0; i < this.PARTICLE_COUNT; i++) {
      this.particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.5, // Start above viewport, spread out
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 3 + 2,
        size: Math.random() * 8 + 4,
        color: this.COLORS[Math.floor(Math.random() * this.COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        opacity: 1,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
      });
    }
  }

  private animate = (): void => {
    const canvas = this.canvasRef().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const elapsed = performance.now() - this.startTime;
    const fadeStart = this.DURATION * 0.7;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of this.particles) {
      // Physics
      p.x += p.vx;
      p.vy += 0.1; // gravity
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.vx *= 0.99; // air resistance

      // Fade out in the last 30% of duration
      if (elapsed > fadeStart) {
        p.opacity = Math.max(0, 1 - (elapsed - fadeStart) / (this.DURATION - fadeStart));
      }

      // Draw
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    if (elapsed < this.DURATION) {
      this.animationId = requestAnimationFrame(this.animate);
    }
  };
}

import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'akri-module-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="ms-wrap">

      <div class="ms-orb ms-orb--1"></div>
      <div class="ms-orb ms-orb--2"></div>
      <div class="ms-orb ms-orb--3"></div>
      <div class="ms-orb ms-orb--4"></div>

      <header class="ms-header">
        <div class="ms-logo">
          <span class="ms-logo-icon">⚕</span>
          <div>
            <div class="ms-logo-name">AkriPharmacy</div>
            <div class="ms-logo-sub">ERP farmacéutico multisede</div>
          </div>
        </div>
      </header>

      <div class="ms-hero">
        <h1 class="ms-title">Selecciona tu módulo</h1>
        <p class="ms-subtitle">Elige el área de trabajo para continuar</p>
      </div>

      <div class="ms-cards">

        <button
          class="ms-card ms-card--pharmacy"
          [class.ms-card--selected]="selected() === 'pharmacy'"
          [disabled]="navigating()"
          (click)="selectModule('pharmacy')"
          type="button"
        >
          <div class="ms-card-glow"></div>
          <div class="ms-card-icon">💊</div>
          <div class="ms-card-body">
            <h2 class="ms-card-title">Farmacia</h2>
            <p class="ms-card-desc">Dispensación, ventas e inventario de farmacia</p>
          </div>
          <div class="ms-card-arrow">→</div>
        </button>

        <button
          class="ms-card ms-card--inventory ms-card--soon"
          [disabled]="navigating()"
          (click)="openInventoryComingSoon()"
          type="button"
        >
          <div class="ms-card-glow"></div>
          <div class="ms-card-soon-badge">Próximamente</div>
          <div class="ms-card-icon">📦</div>
          <div class="ms-card-body">
            <h2 class="ms-card-title">Inventario</h2>
            <p class="ms-card-desc">Control de stock, ingresos, movimientos y trazabilidad</p>
          </div>
          <div class="ms-card-arrow">→</div>
        </button>

      </div>

      <!-- Coming Soon Modal -->
      @if (comingSoonVisible()) {
        <div class="ms-cs-overlay" (click)="closeInventoryComingSoon()">
          <div class="ms-cs-modal" (click)="$event.stopPropagation()">
            <span class="ms-cs-icon">🚀</span>
            <h2 class="ms-cs-title">¡Próximamente!</h2>
            <p class="ms-cs-body">
              Estamos construyendo algo increíble para ti.<br>
              El módulo de <strong>Inventario</strong> estará completamente
              funcional muy pronto, con control de stock, ingresos, movimientos
              y trazabilidad integrada.
            </p>
            <p class="ms-cs-sub">¡Grandes cosas vienen en camino!</p>
            <button class="ms-cs-btn" (click)="closeInventoryComingSoon()">Entendido</button>
          </div>
        </div>
      }

      <footer class="ms-footer">
        <span>© 2025 AkriPharmacy · ERP farmacéutico</span>
      </footer>

    </div>
  `,
  styles: [`
    .ms-wrap {
      position: relative;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1.25rem;
      overflow: hidden;
      background:
        radial-gradient(ellipse 80% 60% at 20% 10%, rgba(109, 40, 217, 0.55) 0%, transparent 60%),
        radial-gradient(ellipse 60% 50% at 80% 90%, rgba(249, 115, 22, 0.35) 0%, transparent 55%),
        radial-gradient(ellipse 50% 40% at 60% 30%, rgba(124, 58, 237, 0.25) 0%, transparent 50%),
        linear-gradient(160deg, #0D0617 0%, #1A0A2E 40%, #0F0A1A 70%, #1A0D0A 100%);
    }

    .ms-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(60px);
      pointer-events: none;
      animation: msFloatOrb var(--orb-dur, 8s) ease-in-out infinite alternate;
    }

    .ms-orb--1 {
      width: 420px; height: 420px;
      top: -120px; left: -100px;
      background: radial-gradient(circle, rgba(109, 40, 217, 0.40) 0%, transparent 70%);
      --orb-dur: 9s;
      animation-delay: 0s;
    }
    .ms-orb--2 {
      width: 320px; height: 320px;
      bottom: -80px; right: -60px;
      background: radial-gradient(circle, rgba(249, 115, 22, 0.35) 0%, transparent 70%);
      --orb-dur: 11s;
      animation-delay: -3s;
    }
    .ms-orb--3 {
      width: 200px; height: 200px;
      top: 40%; right: 10%;
      background: radial-gradient(circle, rgba(139, 92, 246, 0.30) 0%, transparent 70%);
      --orb-dur: 7s;
      animation-delay: -1.5s;
    }
    .ms-orb--4 {
      width: 150px; height: 150px;
      bottom: 20%; left: 8%;
      background: radial-gradient(circle, rgba(234, 88, 12, 0.25) 0%, transparent 70%);
      --orb-dur: 13s;
      animation-delay: -5s;
    }

    @keyframes msFloatOrb {
      0%   { transform: translate(0, 0) scale(1); }
      33%  { transform: translate(18px, -22px) scale(1.06); }
      66%  { transform: translate(-12px, 14px) scale(0.96); }
      100% { transform: translate(8px, -10px) scale(1.03); }
    }

    .ms-header {
      position: absolute;
      top: 0; left: 0; right: 0;
      padding: 1.5rem 2rem;
      display: flex;
      align-items: center;
      animation: msFadeIn 0.5s ease both;
    }

    .ms-logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .ms-logo-icon {
      font-size: 2rem;
      filter: drop-shadow(0 0 12px rgba(139, 92, 246, 0.7));
    }

    .ms-logo-name {
      font-size: 1.3rem;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: -0.02em;
    }

    .ms-logo-sub {
      font-size: 0.78rem;
      color: rgba(255, 255, 255, 0.55);
      margin-top: 1px;
    }

    .ms-hero {
      text-align: center;
      margin-bottom: 2.5rem;
      animation: msFadeInUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
    }

    .ms-title {
      font-size: clamp(1.8rem, 5vw, 3rem);
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: -0.03em;
      margin: 0 0 0.6rem;
      text-shadow: 0 0 40px rgba(139, 92, 246, 0.5);
    }

    .ms-subtitle {
      font-size: clamp(0.95rem, 2vw, 1.1rem);
      color: rgba(255, 255, 255, 0.6);
      margin: 0;
    }

    .ms-cards {
      display: flex;
      gap: 1.75rem;
      justify-content: center;
      flex-wrap: wrap;
      width: 100%;
      max-width: 860px;
    }

    .ms-card {
      position: relative;
      flex: 1 1 320px;
      max-width: 380px;
      min-height: 280px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 2.5rem 2rem;
      border-radius: 28px;
      border: 1px solid rgba(255, 255, 255, 0.10);
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(20px) saturate(1.4);
      -webkit-backdrop-filter: blur(20px) saturate(1.4);
      color: #FFFFFF;
      cursor: pointer;
      overflow: hidden;
      text-align: center;
      transition:
        transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
        box-shadow 0.22s ease,
        border-color 0.22s ease,
        background 0.22s ease;
      animation: msFadeInUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .ms-card:first-child { animation-delay: 0.25s; }
    .ms-card:last-child  { animation-delay: 0.37s; }

    .ms-card-glow {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }

    .ms-card--pharmacy .ms-card-glow {
      background: radial-gradient(ellipse 80% 60% at 50% 40%, rgba(109, 40, 217, 0.35) 0%, transparent 70%);
    }

    .ms-card--inventory .ms-card-glow {
      background: radial-gradient(ellipse 80% 60% at 50% 40%, rgba(249, 115, 22, 0.32) 0%, transparent 70%);
    }

    .ms-card:hover {
      transform: translateY(-10px) scale(1.015);
    }

    .ms-card--pharmacy:hover {
      border-color: rgba(139, 92, 246, 0.55);
      box-shadow:
        0 24px 60px rgba(0, 0, 0, 0.45),
        0 0 0 1px rgba(139, 92, 246, 0.25),
        0 0 50px rgba(109, 40, 217, 0.35);
    }

    .ms-card--inventory:hover {
      border-color: rgba(249, 115, 22, 0.50);
      box-shadow:
        0 24px 60px rgba(0, 0, 0, 0.45),
        0 0 0 1px rgba(249, 115, 22, 0.22),
        0 0 50px rgba(234, 88, 12, 0.30);
    }

    .ms-card:hover .ms-card-glow {
      opacity: 1;
    }

    .ms-card--selected {
      animation: msCardPulse 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards !important;
      pointer-events: none;
    }

    .ms-card--pharmacy.ms-card--selected {
      background: rgba(109, 40, 217, 0.30) !important;
      border-color: rgba(139, 92, 246, 0.7) !important;
      box-shadow:
        0 28px 70px rgba(0, 0, 0, 0.5),
        0 0 60px rgba(109, 40, 217, 0.55) !important;
    }

    .ms-card--inventory.ms-card--selected {
      background: rgba(249, 115, 22, 0.25) !important;
      border-color: rgba(249, 115, 22, 0.7) !important;
      box-shadow:
        0 28px 70px rgba(0, 0, 0, 0.5),
        0 0 60px rgba(234, 88, 12, 0.45) !important;
    }

    @keyframes msCardPulse {
      0%   { transform: translateY(-10px) scale(1.015); }
      35%  { transform: translateY(-14px) scale(1.06);  }
      70%  { transform: translateY(-10px) scale(1.02);  }
      100% { transform: translateY(-10px) scale(1.04);  }
    }

    .ms-card:disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }

    .ms-card-icon {
      font-size: 3.5rem;
      line-height: 1;
      filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.4));
      transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), filter 0.22s ease;
      position: relative;
      z-index: 1;
    }

    .ms-card:hover .ms-card-icon {
      transform: scale(1.12) translateY(-4px);
      filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.5));
    }

    .ms-card-body {
      position: relative;
      z-index: 1;
    }

    .ms-card-title {
      font-size: 1.55rem;
      font-weight: 800;
      margin: 0 0 0.45rem;
      letter-spacing: -0.02em;
      color: #FFFFFF;
    }

    .ms-card-desc {
      font-size: 0.92rem;
      color: rgba(255, 255, 255, 0.65);
      margin: 0;
      line-height: 1.55;
    }

    .ms-card-arrow {
      position: absolute;
      bottom: 1.25rem;
      right: 1.5rem;
      font-size: 1.25rem;
      color: rgba(255, 255, 255, 0.25);
      transition: color 0.2s ease, transform 0.2s ease;
    }

    .ms-card:hover .ms-card-arrow {
      color: rgba(255, 255, 255, 0.7);
      transform: translateX(4px);
    }

    .ms-footer {
      position: absolute;
      bottom: 1.25rem;
      left: 0; right: 0;
      text-align: center;
      font-size: 0.78rem;
      color: rgba(255, 255, 255, 0.28);
      animation: msFadeIn 0.7s ease 0.6s both;
    }

    @keyframes msFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    @keyframes msFadeInUp {
      from { opacity: 0; transform: translateY(28px); }
      to   { opacity: 1; transform: translateY(0);    }
    }

    /* ── Coming-soon card state ─────────────────────────── */
    .ms-card--soon {
      opacity: 0.72;
      cursor: pointer;
    }

    .ms-card--soon:hover {
      opacity: 0.88;
      border-color: rgba(249, 115, 22, 0.40);
      box-shadow:
        0 18px 50px rgba(0, 0, 0, 0.40),
        0 0 40px rgba(234, 88, 12, 0.20);
    }

    .ms-card-soon-badge {
      position: absolute;
      top: 1.1rem;
      right: 1.1rem;
      font-size: 0.62rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      background: linear-gradient(135deg, #F97316 0%, #EA580C 100%);
      color: #FFFFFF;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      z-index: 2;
    }

    /* ── Coming-soon modal overlay ──────────────────────── */
    .ms-cs-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.80);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      animation: msCsOverlayIn 0.22s ease both;
    }

    @keyframes msCsOverlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .ms-cs-modal {
      background: linear-gradient(145deg, #130820 0%, #220D42 55%, #130820 100%);
      border: 1px solid rgba(139, 92, 246, 0.38);
      border-radius: 28px;
      padding: 3rem 2.5rem 2.5rem;
      max-width: 480px;
      width: 90%;
      text-align: center;
      box-shadow:
        0 40px 90px rgba(0, 0, 0, 0.65),
        0 0 70px rgba(109, 40, 217, 0.22);
      animation: msCsModalIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes msCsModalIn {
      from { opacity: 0; transform: scale(0.88) translateY(24px); }
      to   { opacity: 1; transform: scale(1)    translateY(0);    }
    }

    .ms-cs-icon {
      font-size: 4.25rem;
      line-height: 1;
      margin-bottom: 1.25rem;
      display: block;
      animation: msCsFloat 3.5s ease-in-out infinite;
    }

    @keyframes msCsFloat {
      0%, 100% { transform: translateY(0);    }
      50%       { transform: translateY(-9px); }
    }

    .ms-cs-title {
      font-size: 2rem;
      font-weight: 800;
      background: linear-gradient(135deg, #A78BFA 0%, #F97316 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin: 0 0 1rem;
      letter-spacing: -0.025em;
    }

    .ms-cs-body {
      color: rgba(237, 233, 254, 0.82);
      font-size: 1rem;
      line-height: 1.7;
      margin: 0 0 0.65rem;
    }

    .ms-cs-body strong {
      color: #C4B5FD;
    }

    .ms-cs-sub {
      color: rgba(237, 233, 254, 0.40);
      font-size: 0.875rem;
      margin: 0 0 2rem;
    }

    .ms-cs-btn {
      background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);
      border: none;
      border-radius: 14px;
      color: #FFFFFF;
      font-weight: 700;
      font-size: 1rem;
      padding: 0.9rem 2.75rem;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      box-shadow: 0 4px 22px rgba(109, 40, 217, 0.45);
      font-family: inherit;
    }

    .ms-cs-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(109, 40, 217, 0.6);
    }

    .ms-cs-btn:active {
      transform: translateY(0);
    }

    @media (max-width: 700px) {
      .ms-cards {
        flex-direction: column;
        align-items: center;
        gap: 1.25rem;
      }

      .ms-card {
        max-width: 100%;
        min-height: 220px;
        padding: 2rem 1.5rem;
      }

      .ms-title {
        font-size: 1.7rem;
      }

      .ms-header {
        padding: 1.1rem 1.25rem;
      }

      .ms-hero {
        margin-bottom: 1.75rem;
      }
    }
  `]
})
export class ModuleSelectComponent {
  readonly selected = signal<'pharmacy' | 'inventory' | null>(null);
  readonly navigating = signal(false);
  readonly comingSoonVisible = signal(false);

  constructor(private readonly router: Router) {}

  selectModule(module: 'pharmacy' | 'inventory'): void {
    if (this.navigating()) return;
    this.selected.set(module);
    this.navigating.set(true);
    setTimeout(() => {
      void this.router.navigate(['/dashboard']);
    }, 350);
  }

  openInventoryComingSoon(): void {
    this.comingSoonVisible.set(true);
  }

  closeInventoryComingSoon(): void {
    this.comingSoonVisible.set(false);
  }
}

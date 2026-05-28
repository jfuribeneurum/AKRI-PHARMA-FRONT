import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'akri-signature-pad',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="signature-box">
      <canvas #canvas class="signature-canvas"></canvas>
      <div class="signature-actions">
        <button type="button" class="btn secondary btn-small" (click)="clear()">Limpiar firma</button>
        <span class="muted">Firma digital de recepción a conformidad</span>
      </div>
    </div>
  `
})
export class SignaturePadComponent implements AfterViewInit, OnChanges {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() clearTrigger = 0;
  @Output() valueChange = new EventEmitter<string>();

  private context!: CanvasRenderingContext2D;
  private drawing = false;

  ngAfterViewInit() {
    this.initializeCanvas();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['clearTrigger'] && !changes['clearTrigger'].firstChange) {
      this.clear();
    }
  }

  clear() {
    const canvas = this.canvasRef.nativeElement;
    this.context.clearRect(0, 0, canvas.width, canvas.height);
    this.context.fillStyle = '#FFFFFF';
    this.context.fillRect(0, 0, canvas.width, canvas.height);
    this.context.strokeStyle = '#111827';
    this.context.lineWidth = 2;
    this.context.lineCap = 'round';
    this.valueChange.emit('');
  }

  private initializeCanvas() {
    const canvas = this.canvasRef.nativeElement;
    const width = Math.max(320, canvas.parentElement?.clientWidth ?? 520);
    canvas.width = width;
    canvas.height = 180;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    this.context = context;
    this.clear();

    canvas.addEventListener('pointerdown', (event) => this.start(event));
    canvas.addEventListener('pointermove', (event) => this.move(event));
    canvas.addEventListener('pointerup', () => this.finish());
    canvas.addEventListener('pointerleave', () => this.finish());
    canvas.addEventListener('pointercancel', () => this.finish());
  }

  private start(event: PointerEvent) {
    this.drawing = true;
    const { x, y } = this.relativePosition(event);
    this.context.beginPath();
    this.context.moveTo(x, y);
  }

  private move(event: PointerEvent) {
    if (!this.drawing) {
      return;
    }

    const { x, y } = this.relativePosition(event);
    this.context.lineTo(x, y);
    this.context.stroke();
  }

  private finish() {
    if (!this.drawing) {
      return;
    }
    this.drawing = false;
    this.valueChange.emit(this.canvasRef.nativeElement.toDataURL('image/png'));
  }

  private relativePosition(event: PointerEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }
}

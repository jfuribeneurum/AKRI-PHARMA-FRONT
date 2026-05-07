import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'akri-sebas-ingresos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Ingresos Sebas</h1>
          <p class="page-subtitle">Registro separado de ingreso con datos de factura, proveedor, producto, lote y valores.</p>
        </div>
      </div>

      <div *ngIf="message()" class="success-box">{{ message() }}</div>
      <div *ngIf="error()" class="error-box">{{ error() }}</div>

      <div class="card">
        <div class="section-head">
          <div>
            <h3>Nuevo ingreso Sebas</h3>
            <span class="muted">Los campos extendidos quedan consolidados en la referencia y descripcion del ingreso</span>
          </div>
        </div>

        <div class="form-grid">
          <label>Referencia ingreso<input [(ngModel)]="ingreso.referencia" placeholder="ING-SEBAS-001"></label>
          <label>Estado<select [(ngModel)]="ingreso.estado"><option value="pendiente">Pendiente</option><option value="recibido">Recibido</option><option value="almacenado">Almacenado</option><option value="cancelado">Cancelado</option></select></label>
          <label>Numero factura<input [(ngModel)]="factura.numero_factura"></label>
          <label>CUFE / CUDE<input [(ngModel)]="factura.cufe"></label>
          <label>Fecha emision<input type="date" [(ngModel)]="factura.fecha_emision"></label>
          <label>Fecha recepcion<input type="date" [(ngModel)]="factura.fecha_recepcion"></label>
          <label>Orden de compra<input [(ngModel)]="factura.orden_compra"></label>
          <label>Remision<input [(ngModel)]="factura.remision"></label>
          <label>Proveedor<input [(ngModel)]="factura.proveedor_nombre"></label>
          <label>NIT proveedor<input [(ngModel)]="factura.proveedor_nit"></label>
          <label>Telefono proveedor<input [(ngModel)]="factura.proveedor_telefono"></label>
          <label class="full">Direccion proveedor<input [(ngModel)]="factura.proveedor_direccion"></label>
          <label>Cliente / receptor<input [(ngModel)]="factura.cliente_nombre"></label>
          <label>NIT cliente<input [(ngModel)]="factura.cliente_nit"></label>
          <label class="full">Direccion cliente<input [(ngModel)]="factura.cliente_direccion"></label>
          <label>Codigo producto<input [(ngModel)]="factura.codigo_producto"></label>
          <label class="full">Producto / descripcion<input [(ngModel)]="ingreso.producto" placeholder="Descripcion del producto"></label>
          <label>Presentacion<input [(ngModel)]="factura.presentacion"></label>
          <label>Invima / registro sanitario<input [(ngModel)]="factura.registro_sanitario"></label>
          <label>Lote<input [(ngModel)]="ingreso.lote"></label>
          <label>Fecha vencimiento<input type="date" [(ngModel)]="ingreso.fecha_vencimiento"></label>
          <label>Cantidad<input type="number" [(ngModel)]="ingreso.cantidad"></label>
          <label>Unidad medida<input [(ngModel)]="factura.unidad_medida"></label>
          <label>Valor unitario<input type="number" [(ngModel)]="factura.valor_unitario"></label>
          <label>Descuento<input type="number" [(ngModel)]="factura.descuento"></label>
          <label>IVA / impuesto<input type="number" [(ngModel)]="factura.impuesto"></label>
          <label>Subtotal<input type="number" [(ngModel)]="factura.subtotal"></label>
          <label>Total factura<input type="number" [(ngModel)]="factura.total"></label>
          <label>Forma de pago<input [(ngModel)]="factura.forma_pago"></label>
          <label>Medio de pago<input [(ngModel)]="factura.medio_pago"></label>
          <label class="full">Observaciones<textarea [(ngModel)]="factura.observaciones" placeholder="Notas del ingreso, novedades o diferencias contra factura"></textarea></label>
        </div>

        <div class="toolbar" style="margin-top: 1rem;">
          <button class="btn" (click)="crearIngreso()">Crear ingreso Sebas</button>
          <button class="btn secondary" (click)="limpiar()">Limpiar</button>
        </div>
      </div>
    </section>
  `
})
export class SebasIngresosComponent {
  readonly message = signal('');
  readonly error = signal('');

  ingreso: any = this.emptyIngreso();
  factura: any = this.emptyFactura();

  constructor(private readonly api: ApiService) {}

  async crearIngreso() {
    try {
      this.error.set('');
      this.message.set('');
      if (!this.ingreso.referencia || !this.ingreso.producto || !Number(this.ingreso.cantidad)) {
        this.error.set('Completa referencia, producto y cantidad.');
        return;
      }
      await this.api.post('/ingresos', this.ingresoPayload());
      this.message.set('Ingreso Sebas creado exitosamente.');
      this.limpiar();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible crear el ingreso Sebas.');
    }
  }

  limpiar() {
    this.ingreso = this.emptyIngreso();
    this.factura = this.emptyFactura();
  }

  private ingresoPayload() {
    const facturaNotes = Object.entries(this.factura)
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ');
    return {
      referencia: [this.ingreso.referencia, this.factura.numero_factura ? `Factura ${this.factura.numero_factura}` : ''].filter(Boolean).join(' - '),
      producto: [this.ingreso.producto, facturaNotes ? `Datos factura: ${facturaNotes}` : ''].filter(Boolean).join('\n'),
      cantidad: Number(this.ingreso.cantidad),
      lote: this.ingreso.lote || null,
      fecha_vencimiento: this.ingreso.fecha_vencimiento || null,
      estado: this.ingreso.estado
    };
  }

  private emptyIngreso() {
    return {
      referencia: `ING-SEBAS-${Date.now()}`,
      producto: '',
      cantidad: 1,
      lote: '',
      fecha_vencimiento: '',
      estado: 'pendiente'
    };
  }

  private emptyFactura() {
    return {
      numero_factura: '',
      cufe: '',
      fecha_emision: new Date().toISOString().slice(0, 10),
      fecha_recepcion: new Date().toISOString().slice(0, 10),
      orden_compra: '',
      remision: '',
      proveedor_nombre: '',
      proveedor_nit: '',
      proveedor_telefono: '',
      proveedor_direccion: '',
      cliente_nombre: '',
      cliente_nit: '',
      cliente_direccion: '',
      codigo_producto: '',
      presentacion: '',
      registro_sanitario: '',
      unidad_medida: 'UN',
      valor_unitario: 0,
      descuento: 0,
      impuesto: 0,
      subtotal: 0,
      total: 0,
      forma_pago: '',
      medio_pago: '',
      observaciones: ''
    };
  }
}

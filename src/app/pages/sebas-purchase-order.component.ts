import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'akri-sebas-purchase-order',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Orden de compra Sebas</h1>
          <p class="page-subtitle">Formulario separado para registrar ordenes de compra con datos completos de proveedor, entrega, condiciones e item.</p>
        </div>
      </div>

      <div *ngIf="message()" class="success-box">{{ message() }}</div>
      <div *ngIf="error()" class="error-box">{{ error() }}</div>

      <div class="card">
        <div class="section-head">
          <div>
            <h3>Nueva orden</h3>
            <span class="muted">Los campos adicionales se guardan en observaciones de la OC</span>
          </div>
        </div>

        <div class="form-grid">
          <label>
            Numero OC
            <input [(ngModel)]="purchase.numero_oc">
          </label>
          <label>
            Fecha orden
            <input type="date" [(ngModel)]="sebasOrder.fecha_orden">
          </label>
          <label>
            Estado
            <select [(ngModel)]="purchase.estado">
              <option value="borrador">Borrador</option>
              <option value="aprobada">Aprobada</option>
            </select>
          </label>
          <label>
            Proveedor (id)
            <input type="number" [(ngModel)]="purchase.id_proveedor">
          </label>
          <label>
            Proveedor
            <input [(ngModel)]="sebasOrder.proveedor_nombre" placeholder="Nombre del proveedor">
          </label>
          <label>
            NIT proveedor
            <input [(ngModel)]="sebasOrder.proveedor_nit">
          </label>
          <label>
            Contacto proveedor
            <input [(ngModel)]="sebasOrder.proveedor_contacto">
          </label>
          <label>
            Telefono proveedor
            <input [(ngModel)]="sebasOrder.proveedor_telefono">
          </label>
          <label class="full">
            Direccion proveedor
            <input [(ngModel)]="sebasOrder.proveedor_direccion">
          </label>
          <label>
            Solicitante
            <input [(ngModel)]="sebasOrder.solicitante">
          </label>
          <label>
            Comprador
            <input [(ngModel)]="sebasOrder.comprador">
          </label>
          <label>
            Sede entrega
            <input [(ngModel)]="sebasOrder.sede_entrega">
          </label>
          <label>
            Ciudad entrega
            <input [(ngModel)]="sebasOrder.ciudad_entrega">
          </label>
          <label class="full">
            Direccion entrega
            <input [(ngModel)]="sebasOrder.direccion_entrega">
          </label>
          <label>
            Fecha requerida
            <input type="date" [(ngModel)]="purchase.items[0].fecha_requerida">
          </label>
          <label>
            Forma de pago
            <input [(ngModel)]="sebasOrder.forma_pago" placeholder="Credito, contado, etc.">
          </label>
          <label>
            Plazo de pago
            <input [(ngModel)]="sebasOrder.plazo_pago" placeholder="30 dias">
          </label>
          <label>
            Moneda
            <input [(ngModel)]="sebasOrder.moneda">
          </label>
          <label>
            Producto (id)
            <input type="number" [(ngModel)]="purchase.items[0].id_producto">
          </label>
          <label>
            Codigo producto
            <input [(ngModel)]="sebasOrder.item_codigo">
          </label>
          <label class="full">
            Descripcion producto
            <input [(ngModel)]="sebasOrder.item_descripcion">
          </label>
          <label>
            Presentacion
            <input [(ngModel)]="sebasOrder.item_presentacion">
          </label>
          <label>
            Cantidad
            <input type="number" [(ngModel)]="purchase.items[0].cantidad">
          </label>
          <label>
            Precio unitario
            <input type="number" [(ngModel)]="purchase.items[0].precio_unitario">
          </label>
          <label>
            Descuento
            <input type="number" [(ngModel)]="purchase.items[0].descuento">
          </label>
          <label>
            IVA / impuesto
            <input type="number" [(ngModel)]="purchase.items[0].impuesto">
          </label>
          <label class="full">
            Observaciones
            <textarea [(ngModel)]="purchase.observaciones" placeholder="Condiciones, notas o instrucciones especiales"></textarea>
          </label>
        </div>

        <button class="btn" (click)="createPurchase()">Crear orden Sebas</button>
      </div>
    </section>
  `
})
export class SebasPurchaseOrderComponent {
  readonly message = signal('');
  readonly error = signal('');

  purchase: any = {
    numero_oc: `OC-${Date.now()}`,
    id_proveedor: 1,
    estado: 'borrador',
    observaciones: '',
    items: [{ id_producto: 1, cantidad: 10, precio_unitario: 1500, descuento: 0, impuesto: 0, fecha_requerida: null }]
  };

  sebasOrder: any = {
    fecha_orden: new Date().toISOString().slice(0, 10),
    proveedor_nombre: '',
    proveedor_nit: '',
    proveedor_contacto: '',
    proveedor_telefono: '',
    proveedor_direccion: '',
    solicitante: '',
    comprador: '',
    sede_entrega: 'Sede Central Bogota',
    ciudad_entrega: 'Bogota',
    direccion_entrega: '',
    forma_pago: '',
    plazo_pago: '',
    moneda: 'COP',
    item_codigo: '',
    item_descripcion: '',
    item_presentacion: ''
  };

  constructor(private readonly api: ApiService) {}

  async createPurchase() {
    try {
      this.error.set('');
      await this.api.post('/purchases', this.purchasePayload());
      this.message.set('Orden de compra Sebas creada.');
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible crear la orden de compra Sebas.');
    }
  }

  private purchasePayload() {
    const sebasNotes = Object.entries(this.sebasOrder)
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    const baseNotes = String(this.purchase.observaciones ?? '').trim();

    return {
      numero_oc: this.purchase.numero_oc,
      id_proveedor: Number(this.purchase.id_proveedor),
      estado: this.purchase.estado,
      observaciones: [baseNotes, sebasNotes ? `Orden de compra Sebas\n${sebasNotes}` : '']
        .filter(Boolean)
        .join('\n\n'),
      items: this.purchase.items.map((item: any) => ({
        id_producto: Number(item.id_producto),
        cantidad: Number(item.cantidad),
        precio_unitario: Number(item.precio_unitario),
        descuento: Number(item.descuento ?? 0),
        impuesto: Number(item.impuesto ?? 0),
        fecha_requerida: item.fecha_requerida || null
      }))
    };
  }
}

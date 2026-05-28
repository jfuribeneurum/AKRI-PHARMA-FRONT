import { Injectable, signal } from '@angular/core';

export type ScannerChannel = 'keyboard_wedge' | 'webhid' | 'webserial' | 'webusb' | 'camera' | 'image_upload' | 'manual';
export type ScannerFamily = 'lapiz_optico' | 'ranura' | 'ccd' | 'imagen' | 'laser_pistola' | 'generic_wedge' | 'desconocido';
export type ScannerFormFactor = 'pistola' | 'fijo' | 'mesa' | 'portatil' | 'wearable' | 'desconocida';

export interface DetectedScannerCapability {
  channel: ScannerChannel;
  available: boolean;
  requiresPermission: boolean;
  inferredFamily: ScannerFamily;
  inferredFormFactor: ScannerFormFactor;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class ScannerOrchestratorService {
  readonly capabilities = signal<DetectedScannerCapability[]>([]);
  readonly secureContext = signal<boolean>(typeof window !== 'undefined' ? window.isSecureContext : false);

  async detectCapabilities() {
    const nav = navigator as Navigator & { hid?: { getDevices?: () => Promise<any[]> }, serial?: { getPorts?: () => Promise<any[]> }, usb?: { getDevices?: () => Promise<any[]> } };
    const canUseDetector = typeof (globalThis as any).BarcodeDetector !== 'undefined';
    const hidDevices = nav.hid?.getDevices ? await nav.hid.getDevices().catch(() => []) : [];
    const serialPorts = nav.serial?.getPorts ? await nav.serial.getPorts().catch(() => []) : [];
    const usbDevices = nav.usb?.getDevices ? await nav.usb.getDevices().catch(() => []) : [];

    this.capabilities.set([
      { channel: 'keyboard_wedge', available: true, requiresPermission: false, inferredFamily: 'generic_wedge', inferredFormFactor: 'desconocida', label: 'Keyboard wedge / emulación de teclado' },
      { channel: 'webhid', available: !!nav.hid, requiresPermission: true, inferredFamily: hidDevices.length ? 'desconocido' : 'desconocido', inferredFormFactor: 'desconocida', label: hidDevices.length ? `${hidDevices.length} dispositivo(s) HID autorizados` : 'WebHID disponible' },
      { channel: 'webserial', available: !!nav.serial, requiresPermission: true, inferredFamily: 'desconocido', inferredFormFactor: 'wearable', label: serialPorts.length ? `${serialPorts.length} puerto(s) seriales autorizados` : 'Web Serial disponible' },
      { channel: 'webusb', available: !!nav.usb, requiresPermission: true, inferredFamily: 'desconocido', inferredFormFactor: 'desconocida', label: usbDevices.length ? `${usbDevices.length} dispositivo(s) USB autorizados` : 'WebUSB disponible' },
      { channel: 'camera', available: canUseDetector && !!navigator.mediaDevices?.getUserMedia, requiresPermission: true, inferredFamily: 'imagen', inferredFormFactor: 'portatil', label: canUseDetector ? 'Lectura por cámara / scanner de imagen' : 'Cámara disponible sin BarcodeDetector' },
      { channel: 'image_upload', available: true, requiresPermission: false, inferredFamily: 'imagen', inferredFormFactor: 'mesa', label: 'Imagen importada o fotografía directa' },
      { channel: 'manual', available: true, requiresPermission: false, inferredFamily: 'desconocido', inferredFormFactor: 'desconocida', label: 'Ingreso manual de contingencia' }
    ]);
  }
}

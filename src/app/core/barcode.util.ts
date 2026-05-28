export function barcodeDetectorSupported(): boolean {
  return typeof globalThis !== 'undefined' && 'BarcodeDetector' in globalThis;
}

export async function decodeBarcodeFromFile(file: File): Promise<string | null> {
  if (!barcodeDetectorSupported()) {
    throw new Error('Este navegador no soporta lectura automática desde imagen. Usa un lector USB/Bluetooth o captura manual.');
  }

  const Detector = (globalThis as any).BarcodeDetector;
  const detector = new Detector({
    formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'codabar', 'qr_code']
  });
  const bitmap = await createImageBitmap(file);

  try {
    const results = await detector.detect(bitmap);
    return results?.[0]?.rawValue?.trim() ?? null;
  } finally {
    if (typeof (bitmap as any).close === 'function') {
      (bitmap as any).close();
    }
  }
}

export function normalizeBarcode(value: string): string {
  return String(value ?? '').trim();
}

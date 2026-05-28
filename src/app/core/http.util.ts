export function readApiError(error: any): string {
  return error?.error?.message || error?.message || 'No fue posible completar la operación.';
}

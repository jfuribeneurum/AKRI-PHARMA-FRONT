import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

interface Almacen {
  id_almacen: number;
  codigo: string;
  nombre: string;
  tipo: string;
  es_principal: boolean | number;
}

@Injectable({ providedIn: 'root' })
export class SiteContextService {
  private readonly api = inject(ApiService);

  almacenes = signal<Almacen[]>([]);
  activeAlmacenId = signal<number | null>(null);

  private currentUser(): any {
    try {
      return JSON.parse(localStorage.getItem('akri_user') ?? 'null');
    } catch {
      return null;
    }
  }

  hydrateFromUser(user: any) {
    if (!user) return;
    this.almacenes.set(user.almacenes ?? []);
    this.activeAlmacenId.set(user.id_almacen_principal ?? null);
    localStorage.setItem('akri_user', JSON.stringify(user));
  }

  async init() {
    this.hydrateFromUser(this.currentUser());
    if (!localStorage.getItem('akri_token')) return;
    try {
      const res = await this.api.get<{ success: boolean; data: Almacen[] }>('/auth/almacenes');
      this.almacenes.set(res.data ?? []);
    } catch {
      /* keep whatever came from the cached user */
    }
  }

  async switchAlmacen(idAlmacen: number) {
    const res = await this.api.post<{ success: boolean; data: { token: string; user: any } }>(
      '/auth/select-almacen',
      { id_almacen: idAlmacen }
    );
    localStorage.setItem('akri_token', res.data.token);
    this.hydrateFromUser(res.data.user);
  }
}

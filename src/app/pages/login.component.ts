import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'akri-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-wrap">
      <div class="card login-card">
        <h1>AkriPharmacy</h1>
        <p class="muted">ERP de inventario y dispensación farmacéutica</p>

        <div class="notice" style="margin-bottom: 1rem;">
          Demo: admin / Akri123*
        </div>

        <div *ngIf="error()" class="error" style="margin-bottom: 1rem;">
          {{ error() }}
        </div>

        <div class="form-grid" style="grid-template-columns: 1fr;">
          <label>
            Usuario
            <input [(ngModel)]="username" name="username" placeholder="admin">
          </label>

          <label>
            Contraseña
            <input [(ngModel)]="password" name="password" type="password" placeholder="••••••••">
          </label>
        </div>

        <div style="margin-top: 1rem;">
          <button class="btn" [disabled]="loading()" (click)="submit()">
            {{ loading() ? 'Ingresando...' : 'Ingresar' }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  username = 'admin';
  password = 'Akri123*';
  loading = signal(false);
  error = signal('');

  constructor(
    private readonly api: ApiService,
    private readonly router: Router
  ) {}

  async submit() {
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await this.api.post<{ success: boolean; data: { token: string; user: unknown } }>(
        '/auth/login',
        { username: this.username, password: this.password }
      );

      localStorage.setItem('akri_token', response.data.token);
      localStorage.setItem('akri_user', JSON.stringify(response.data.user));
      await this.router.navigate(['/dashboard']);
    } catch (error: any) {
      this.error.set(error?.error?.message ?? 'No fue posible iniciar sesión');
    } finally {
      this.loading.set(false);
    }
  }
}

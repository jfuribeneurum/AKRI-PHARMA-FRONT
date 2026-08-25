import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { SiteContextService } from '../../core/site-context.service';

@Component({
  selector: 'akri-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  username = 'admin';
  password = 'Akri123*';
  loading = signal(false);
  error = signal('');

  constructor(
    private readonly api: ApiService,
    private readonly router: Router,
    private readonly siteContext: SiteContextService
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
      this.siteContext.hydrateFromUser(response.data.user);
      await this.router.navigate(['/module-select']);
    } catch (error: any) {
      this.error.set(error?.error?.message ?? 'No fue posible iniciar sesión');
    } finally {
      this.loading.set(false);
    }
  }
}

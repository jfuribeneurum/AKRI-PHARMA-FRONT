import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  get<T>(path: string) {
    return firstValueFrom(this.http.get<T>(this.buildUrl(path)));
  }

  post<T>(path: string, body: unknown) {
    return firstValueFrom(this.http.post<T>(this.buildUrl(path), body));
  }

  put<T>(path: string, body: unknown) {
    return firstValueFrom(this.http.put<T>(this.buildUrl(path), body));
  }

  delete<T>(path: string) {
    return firstValueFrom(this.http.delete<T>(this.buildUrl(path)));
  }

  async download(path: string, fallbackFilename: string) {
    const response = await firstValueFrom(
      this.http.get(this.buildUrl(path), {
        observe: 'response',
        responseType: 'blob'
      })
    );

    const blob = response.body ?? new Blob();
    const disposition = response.headers.get('content-disposition');
    const filename = this.extractFilename(disposition) || fallbackFilename;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 500);
    return filename;
  }

  private buildUrl(path: string) {
    const normalized = String(path ?? '').trim();
    if (!normalized) {
      return this.baseUrl;
    }
    return normalized.startsWith('/') ? `${this.baseUrl}${normalized}` : `${this.baseUrl}/${normalized}`;
  }

  private extractFilename(disposition: string | null) {
    if (!disposition) {
      return null;
    }

    const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    if (utfMatch?.[1]) {
      return decodeURIComponent(utfMatch[1]);
    }

    const basicMatch = /filename="?([^";]+)"?/i.exec(disposition);
    return basicMatch?.[1] ?? null;
  }
}

import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('prefixes GET requests with environment.apiUrl', async () => {
    const promise = service.get('/warehouses');
    const req = httpMock.expectOne(`${environment.apiUrl}/warehouses`);
    expect(req.request.method).toBe('GET');
    req.flush({ ok: true });
    await promise;
  });

  it('normalizes a path without a leading slash', async () => {
    const promise = service.get('warehouses');
    const req = httpMock.expectOne(`${environment.apiUrl}/warehouses`);
    expect(req.request.method).toBe('GET');
    req.flush({ ok: true });
    await promise;
  });

  it('falls back to the bare base url for an empty path', async () => {
    const promise = service.get('');
    const req = httpMock.expectOne(environment.apiUrl);
    expect(req.request.method).toBe('GET');
    req.flush({ ok: true });
    await promise;
  });

  it('sends the body on POST requests', async () => {
    const body = { name: 'Bodega Central' };
    const promise = service.post('/warehouses', body);
    const req = httpMock.expectOne(`${environment.apiUrl}/warehouses`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 1, ...body });
    await promise;
  });

  it('sends the body on PUT requests', async () => {
    const body = { name: 'Bodega Actualizada' };
    const promise = service.put('/warehouses/1', body);
    const req = httpMock.expectOne(`${environment.apiUrl}/warehouses/1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 1, ...body });
    await promise;
  });

  it('sends the body on PATCH requests', async () => {
    const body = { active: false };
    const promise = service.patch('/warehouses/1', body);
    const req = httpMock.expectOne(`${environment.apiUrl}/warehouses/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 1, ...body });
    await promise;
  });

  it('issues DELETE requests against the prefixed url', async () => {
    const promise = service.delete('/warehouses/1');
    const req = httpMock.expectOne(`${environment.apiUrl}/warehouses/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;
  });

  it('downloads a blob and derives the filename from content-disposition', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const promise = service.download('/reports/1/export', 'fallback.csv');
    const req = httpMock.expectOne(`${environment.apiUrl}/reports/1/export`);
    req.flush(new Blob(['a,b,c']), {
      headers: { 'content-disposition': 'attachment; filename="report.csv"' }
    });

    const filename = await promise;
    expect(filename).toBe('report.csv');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('uses the fallback filename when content-disposition is missing', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const promise = service.download('/reports/1/export', 'fallback.csv');
    const req = httpMock.expectOne(`${environment.apiUrl}/reports/1/export`);
    req.flush(new Blob(['a,b,c']));

    const filename = await promise;
    expect(filename).toBe('fallback.csv');
  });
});

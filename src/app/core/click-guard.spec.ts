import { HttpRequest, HttpResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { installClickGuard, MIN_LOCK_MS, pendingMutationsInterceptor, resetClickGuardForTests } from './click-guard';

describe('click-guard', () => {
  let installed = false;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    if (!installed) {
      installClickGuard();
      installed = true;
    }
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    resetClickGuardForTests();
    container.remove();
    vi.useRealTimers();
  });

  function makeButton(attrs: Record<string, string> = {}) {
    const btn = document.createElement('button');
    for (const [k, v] of Object.entries(attrs)) btn.setAttribute(k, v);
    const handler = vi.fn();
    btn.addEventListener('click', handler);
    container.appendChild(btn);
    return { btn, handler };
  }

  function startMutation(method = 'POST') {
    const response$ = new Subject<any>();
    const sub = pendingMutationsInterceptor(new HttpRequest(method as any, '/api/x', null), () => response$)
      .subscribe({ error: () => {} });
    return {
      finish: () => { response$.next(new HttpResponse({ status: 200 })); response$.complete(); },
      fail: () => response$.error(new Error('500')),
      sub
    };
  }

  it('ignores a second click on the same button while it is locked', () => {
    const { btn, handler } = makeButton();
    btn.click();
    btn.click();
    btn.click();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(btn.classList.contains('click-locked')).toBe(true);
  });

  it('unlocks the button after the minimum lock time when no request is pending', () => {
    const { btn, handler } = makeButton();
    btn.click();
    vi.advanceTimersByTime(MIN_LOCK_MS);
    expect(btn.classList.contains('click-locked')).toBe(false);
    btn.click();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('keeps the button locked until the save request finishes', () => {
    const { btn, handler } = makeButton();
    btn.click();
    const req = startMutation('POST');
    vi.advanceTimersByTime(MIN_LOCK_MS * 5);
    btn.click();
    expect(handler).toHaveBeenCalledTimes(1);

    req.finish();
    btn.click();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('unlocks the button when the request fails, so the user can retry', () => {
    const { btn, handler } = makeButton();
    btn.click();
    const req = startMutation('PUT');
    vi.advanceTimersByTime(MIN_LOCK_MS);
    req.fail();
    btn.click();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('does not keep buttons locked because of GET requests', () => {
    const { btn, handler } = makeButton();
    btn.click();
    startMutation('GET');
    vi.advanceTimersByTime(MIN_LOCK_MS);
    btn.click();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('does not block a different button', () => {
    const a = makeButton();
    const b = makeButton();
    a.btn.click();
    b.btn.click();
    expect(a.handler).toHaveBeenCalledTimes(1);
    expect(b.handler).toHaveBeenCalledTimes(1);
  });

  it('lets buttons marked with data-multi-click receive every click', () => {
    const { btn, handler } = makeButton({ 'data-multi-click': '' });
    btn.click();
    btn.click();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('guards clicks on elements inside a button (icon/span)', () => {
    const { btn, handler } = makeButton();
    const span = document.createElement('span');
    btn.appendChild(span);
    span.click();
    span.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

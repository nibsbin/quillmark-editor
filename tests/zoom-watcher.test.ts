/**
 * `watchZoom` contract tests. Simulates DPR changes via a fake matchMedia
 * and pinch-zoom via a fake `visualViewport`, then verifies the callback
 * fires and the cleanup function detaches both listeners.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { watchZoom } from '../src/core/zoom-watcher.js';

interface FakeMediaQueryList {
  media: string;
  matches: boolean;
  addEventListener: (type: 'change', listener: () => void) => void;
  removeEventListener: (type: 'change', listener: () => void) => void;
  fire: () => void;
}

function makeFakeMatchMedia() {
  const lists: FakeMediaQueryList[] = [];
  const mm = (media: string): FakeMediaQueryList => {
    const listeners = new Set<() => void>();
    const list: FakeMediaQueryList = {
      media,
      matches: true,
      addEventListener: (_type, listener) => listeners.add(listener),
      removeEventListener: (_type, listener) => listeners.delete(listener),
      fire: () => listeners.forEach((l) => l()),
    };
    lists.push(list);
    return list;
  };
  return { mm: mm as unknown as typeof window.matchMedia, lists };
}

interface FakeVisualViewport {
  scale: number;
  addEventListener: (type: 'resize', listener: () => void) => void;
  removeEventListener: (type: 'resize', listener: () => void) => void;
  fire: () => void;
  listenerCount: () => number;
}

function makeFakeVisualViewport(initialScale = 1): FakeVisualViewport {
  const listeners = new Set<() => void>();
  return {
    scale: initialScale,
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    fire: () => listeners.forEach((l) => l()),
    listenerCount: () => listeners.size,
  };
}

describe('watchZoom', () => {
  let originalMatchMedia: typeof window.matchMedia;
  let originalVisualViewport: typeof window.visualViewport;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalVisualViewport = window.visualViewport;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: originalVisualViewport,
    });
  });

  it('returns a no-op when matchMedia is unavailable', () => {
    (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
    const cb = vi.fn();
    const stop = watchZoom(cb);
    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();
    expect(cb).not.toHaveBeenCalled();
  });

  it('fires the callback when DPR matchMedia changes, then re-arms', () => {
    const { mm, lists } = makeFakeMatchMedia();
    window.matchMedia = mm;
    const cb = vi.fn();

    const stop = watchZoom(cb);
    expect(lists).toHaveLength(1);
    expect(lists[0]?.media).toMatch(/dppx\)$/);

    // Simulate browser zoom — the threshold media query fires.
    lists[0]!.fire();
    expect(cb).toHaveBeenCalledTimes(1);
    // Re-arm: a new MediaQueryList should be subscribed.
    expect(lists).toHaveLength(2);

    lists[1]!.fire();
    expect(cb).toHaveBeenCalledTimes(2);

    stop();
  });

  it('fires the callback on visualViewport pinch-zoom (scale change only)', () => {
    const { mm } = makeFakeMatchMedia();
    window.matchMedia = mm;
    const vv = makeFakeVisualViewport(1);
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    const cb = vi.fn();
    const stop = watchZoom(cb);

    // resize without scale change (e.g., keyboard popup) → no fire.
    vv.fire();
    expect(cb).not.toHaveBeenCalled();

    // Pinch-zoom: scale changes → fire.
    vv.scale = 1.5;
    vv.fire();
    expect(cb).toHaveBeenCalledTimes(1);

    // Same scale repeated → no extra fire.
    vv.fire();
    expect(cb).toHaveBeenCalledTimes(1);

    stop();
  });

  it('cleanup detaches all listeners', () => {
    const { mm, lists } = makeFakeMatchMedia();
    window.matchMedia = mm;
    const vv = makeFakeVisualViewport(1);
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    const cb = vi.fn();
    const stop = watchZoom(cb);
    expect(vv.listenerCount()).toBe(1);

    stop();

    // After stop, firing either source should not invoke the callback.
    lists[0]!.fire();
    vv.scale = 2;
    vv.fire();
    expect(cb).not.toHaveBeenCalled();
    expect(vv.listenerCount()).toBe(0);
  });
});

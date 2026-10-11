import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(() => cleanup());
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
});
HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
HTMLDialogElement.prototype.close = function () {
  this.open = false;
};

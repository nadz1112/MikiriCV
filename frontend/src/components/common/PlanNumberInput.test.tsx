// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PlanNumberInput } from './PlanNumberInput';
afterEach(cleanup);
it('allows empty drafts and rejects values below the plan minimum without clamping the spinner', () => {
  render(<PlanNumberInput label="Output" min={1024} max={32768} value={4096} onChange={vi.fn()} />);
  const input = screen.getByLabelText('Output') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '' } });
  expect(input.value).toBe('');
  fireEvent.change(input, { target: { value: '02' } });
  expect(input.value).toBe('2');
  input.stepUp(); fireEvent.change(input);
  expect(input.value).toBe('3');
  expect(input.checkValidity()).toBe(false);
  fireEvent.change(input, { target: { value: '2048' } });
  expect(input.checkValidity()).toBe(true);
});

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobFormModal } from '../../features/jobs/components/JobFormModal';
afterEach(cleanup);

it('keeps the JD form open on backdrop click and Escape, and closes with X', async () => {
  const user = userEvent.setup();
  const close = vi.fn();
  const { container } = render(<div style={{ transform: 'translateY(10px)' }}><JobFormModal isOpen editingJob={null} onClose={close} onSuccess={vi.fn()} /></div>);
  const dialog = screen.getByRole('dialog');
  expect(container.contains(dialog)).toBe(false);
  await user.click(dialog.parentElement!);
  await user.keyboard('{Escape}');
  expect(close).not.toHaveBeenCalled();
  expect(document.body.style.overflow).toBe('hidden');
  await user.click(screen.getByRole('button', { name: 'Đóng' }));
  expect(close).toHaveBeenCalledOnce();
});

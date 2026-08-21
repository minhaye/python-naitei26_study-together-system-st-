import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApiError } from '../../lib/apiClient';
import { updateGroup } from '../../lib/group.api';
import { GroupSettingsModal } from './GroupSettingsModal';
import type { Group } from '../../lib/group.types';

vi.mock('../../lib/group.api', () => ({
  updateGroup: vi.fn(),
  uploadGroupBackground: vi.fn(),
  removeGroupBackground: vi.fn(),
}));

const mockedUpdateGroup = vi.mocked(updateGroup);

function baseGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'group-1',
    name: 'Nhóm Python',
    description: 'Mô tả cũ',
    avatar_url: null,
    background_url: null,
    owner_id: 'user-1',
    invite_code: 'abc123',
    is_public: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('GroupSettingsModal', () => {
  beforeEach(() => {
    mockedUpdateGroup.mockReset();
  });

  function renderModal(group = baseGroup(), onUpdated = vi.fn(), onClose = vi.fn(), isOwner = true) {
    render(<GroupSettingsModal isOpen group={group} onClose={onClose} onUpdated={onUpdated} isOwner={isOwner} />);
    return { onUpdated, onClose };
  }

  it('loads current values into the form', () => {
    renderModal(baseGroup({ name: 'Nhóm Toán', description: 'Ôn thi', is_public: false }));
    expect(screen.getByDisplayValue('Nhóm Toán')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ôn thi')).toBeInTheDocument();
  });

  it('saves edited fields and reports the updated group', async () => {
    const group = baseGroup();
    const updated = { ...group, name: 'Nhóm mới', description: 'Mô tả mới', is_public: false };
    mockedUpdateGroup.mockResolvedValue(updated);
    const { onUpdated } = renderModal(group);

    fireEvent.change(screen.getByDisplayValue('Nhóm Python'), { target: { value: 'Nhóm mới' } });
    fireEvent.change(screen.getByDisplayValue('Mô tả cũ'), { target: { value: 'Mô tả mới' } });
    fireEvent.click(screen.getByText('Riêng tư'));
    fireEvent.click(screen.getByText('Lưu thay đổi'));

    await waitFor(() =>
      expect(mockedUpdateGroup).toHaveBeenCalledWith('group-1', {
        name: 'Nhóm mới',
        description: 'Mô tả mới',
        is_public: false,
      })
    );
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
    expect(await screen.findByText('Đã lưu thay đổi')).toBeInTheDocument();
  });

  it('shows a backend error and keeps the form editable on failure', async () => {
    mockedUpdateGroup.mockRejectedValue(new ApiError(403, 'Only the group owner can update this group'));
    const { onUpdated } = renderModal();

    fireEvent.click(screen.getByText('Lưu thay đổi'));

    await waitFor(() =>
      expect(screen.getByText('Only the group owner can update this group')).toBeInTheDocument()
    );
    expect(onUpdated).not.toHaveBeenCalled();
    expect(screen.getByText('Lưu thay đổi')).not.toBeDisabled();
  });

  it('rejects an empty name client-side without calling the API', () => {
    renderModal();
    fireEvent.change(screen.getByDisplayValue('Nhóm Python'), { target: { value: '   ' } });
    expect(screen.getByText('Lưu thay đổi')).toBeDisabled();
  });

  it('prevents duplicate submissions while a save is pending', async () => {
    let resolveSave: (value: Group) => void = () => {};
    mockedUpdateGroup.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        })
    );
    renderModal();

    const saveButton = screen.getByText('Lưu thay đổi');
    fireEvent.click(saveButton);
    fireEvent.click(screen.getByText('Đang lưu...'));

    expect(mockedUpdateGroup).toHaveBeenCalledTimes(1);
    resolveSave(baseGroup());
    await waitFor(() => expect(screen.getByText('Lưu thay đổi')).toBeInTheDocument());
  });
});

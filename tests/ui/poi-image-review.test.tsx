// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CityPoiList } from '../../src/features/map/MapNavigationList.tsx';
import { addPoiImage, loadPoiImages, movePoiImage, removePoiImage, type PoiReviewImage } from '../../src/features/map/poi-image-store.ts';

vi.mock('../../src/features/map/poi-image-store.ts', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../src/features/map/poi-image-store.ts')>(),
  loadPoiImages: vi.fn(), addPoiImage: vi.fn(), removePoiImage: vi.fn(), movePoiImage: vi.fn(),
}));
const poi = {
  id: 'poi-test', cityId: 'city-test', name: 'Museum', localizedName: null,
  category: 'Attraction' as const, subcategory: 'museum',
  location: { latitude: 48, longitude: 11 }, imagePath: null,
};
let stored: PoiReviewImage[];
beforeEach(() => {
  stored = [];
  vi.mocked(loadPoiImages).mockImplementation(async () => [...stored]);
  vi.mocked(addPoiImage).mockImplementation(async (poiId, file) => {
    const image = { id: `${poiId}:${file.name}`, poiId, name: file.name, blob: file };
    stored = [...stored.filter(({ id }) => id !== image.id), image];
    return image;
  });
  vi.mocked(removePoiImage).mockImplementation(async (id) => {
    stored = stored.filter((image) => image.id !== id);
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true,
    value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true,
    value() { this.removeAttribute('open'); } });
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() }));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

async function dropImages(files: File[]) {
  await waitFor(() => expect(loadPoiImages).toHaveBeenCalled());
  fireEvent.drop(screen.getByRole('button', { name: 'Focus Museum' }), { dataTransfer: { files } });
  await screen.findByRole('button', { name: 'View images for Museum' });
}

describe('local POI image review', () => {
  it('shows a failed reorder in the gallery while preserving the saved order', async () => {
    const user = userEvent.setup();
    stored = ['a.jpg', 'b.jpg'].map((name, position) => ({ id: name, poiId: poi.id, name, position, blob: new Blob(['a']) }));
    vi.mocked(movePoiImage).mockRejectedValue(new Error('Storage unavailable'));
    render(<CityPoiList cityName="Test city" pois={[poi]} onFocus={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'View images for Museum' }));
    const gallery = screen.getByRole('dialog');
    fireEvent.keyDown(within(gallery).getByLabelText('Reorder a.jpg'), { key: 'ArrowRight', altKey: true });
    await waitFor(() => expect(within(gallery).getByRole('status')).toHaveTextContent('Could not save image order'));
    expect(within(gallery).getAllByRole('img').map((image) => image.getAttribute('alt'))).toEqual(['a.jpg', 'b.jpg']);
  });

  it('assigns multiple dropped images, restores them on remount, and removes only the selected assignment', async () => {
    const user = userEvent.setup();
    const focus = vi.fn();
    const view = render(<CityPoiList cityName="Test city" pois={[poi]} onFocus={focus} />);
    const files = [new File(['a'], 'a.jpg', { type: 'image/jpeg' }), new File(['b'], 'b.png', { type: 'image/png' })];
    await dropImages(files);
    const badge = screen.getByRole('button', { name: 'View images for Museum' });
    await waitFor(() => expect(badge).toHaveTextContent('2'));
    await user.click(badge);
    expect(focus).not.toHaveBeenCalled();
    const gallery = screen.getByRole('dialog', { name: 'Images for Museum' });
    expect(within(gallery).getAllByRole('img')).toHaveLength(2);
    await user.click(within(gallery).getByRole('button', { name: 'Remove a.jpg' }));
    await waitFor(() => expect(within(gallery).queryByRole('img', { name: 'a.jpg' })).not.toBeInTheDocument());
    expect(within(gallery).getByRole('img', { name: 'b.png' })).toBeInTheDocument();
    fireEvent.click(gallery);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.unmount();
    render(<CityPoiList cityName="Test city" pois={[poi]} onFocus={focus} />);
    expect(await screen.findByRole('button', { name: 'View images for Museum' })).toHaveTextContent('1');
    expect(stored[0]?.name).toBe('b.png');
  });

  it('does not duplicate the same assignment and closes with Escape without navigating', async () => {
    const user = userEvent.setup();
    render(<CityPoiList cityName="Test city" pois={[poi]} onFocus={vi.fn()} />);
    const file = new File(['a'], 'same.jpg', { type: 'image/jpeg' });
    await dropImages([file, file]);
    const badge = screen.getByRole('button', { name: 'View images for Museum' });
    await waitFor(() => expect(badge).toHaveTextContent('1'));
    await user.click(badge);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(badge).toHaveFocus();
  });

  it('reports save failures without displaying a false count', async () => {
    vi.mocked(addPoiImage).mockRejectedValue(new Error('Storage full'));
    render(<CityPoiList cityName="Test city" pois={[poi]} onFocus={vi.fn()} />);
    await waitFor(() => expect(loadPoiImages).toHaveBeenCalled());
    fireEvent.drop(screen.getByRole('button', { name: 'Focus Museum' }), {
      dataTransfer: { files: [new File(['a'], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Storage full'));
    expect(screen.queryByRole('button', { name: 'View images for Museum' })).not.toBeInTheDocument();
  });
});

import { useEffect, useRef, useState } from 'react';
import { addPoiImage, loadPoiImages, movePoiImage, removePoiImage, sortPoiImages, type PoiReviewImage } from './poi-image-store.ts';
import './poi-image-review.css';

export function usePoiImageReview(enabled: boolean) {
  const [images, setImages] = useState<PoiReviewImage[]>([]);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    loadPoiImages().then((loaded) => {
      if (mounted) { setImages(loaded); setReady(true); }
    }).catch(() => {
      if (mounted) setStatus('Could not load or sanitize local images. Check browser storage and image format, then reload.');
    });
    return () => { mounted = false; };
  }, [enabled]);

  async function add(poiId: string, files: File[]) {
    if (!ready) { setStatus('Image storage is not ready. Please wait or reload before dropping files.'); return; }
    if (!files.length) return;
    setPending((count) => count + 1);
    let saved = 0;
    const errors: string[] = [];
    for (const file of files) {
      try {
        const image = await addPoiImage(poiId, file);
        setImages((current) => sortPoiImages([...current.filter(({ id }) => id !== image.id), image]));
        saved += 1;
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Could not save image. Check available browser storage.'}`);
      }
    }
    setStatus(`${saved} image(s) saved locally.${errors.length ? ` ${errors.join(' ')}` : ''}`);
    setPending((count) => count - 1);
  }

  async function remove(id: string) {
    try {
      await removePoiImage(id);
      setImages((current) => current.filter((image) => image.id !== id));
      setStatus('Image assignment removed. Original file is unchanged.');
    } catch {
      setStatus('Could not remove image. Please try again.');
    }
  }

  async function move(poiId: string, sourceId: string, targetId: string) {
    setPending((count) => count + 1);
    try {
      const ordered = await movePoiImage(poiId, sourceId, targetId);
      setImages((current) => sortPoiImages([...current.filter((image) => image.poiId !== poiId), ...ordered]));
      setStatus('Image order saved locally.');
    } catch {
      setStatus('Could not save image order. Please try again.');
    } finally {
      setPending((count) => count - 1);
    }
  }

  return { images, ready, status, pending, add, remove, move };
}

function ReviewImage({ image, onRemove }: {
  image: PoiReviewImage;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(image.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [image.blob]);
  return <>
    {url && <img src={url} alt={image.name} draggable={false} />}
    <figcaption>{image.name}</figcaption>
    <button type="button" className="poi-image-remove" aria-label={`Remove ${image.name}`} onClick={onRemove}>×</button>
  </>;
}

export function PoiImageGallery({ name, images, onRemove, onClose, onMove, saving, status }: {
  name: string;
  images: PoiReviewImage[];
  onRemove: (id: string) => void;
  onClose: () => void;
  onMove: (sourceId: string, targetId: string) => void;
  saving: boolean;
  status: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);
  return <dialog className="poi-image-dialog" ref={dialog} aria-label={`Images for ${name}`}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="poi-image-dialog-content">
      <header><div><p>Local image review</p><h2>{name}</h2><span>{images.length} images</span></div>
        <button type="button" aria-label="Close image gallery" onClick={onClose}>×</button></header>
      <p className="poi-image-sort-hint">Drag photos to reorder. Alt + arrow keys also reorder.</p>
      <p className="poi-image-status" role="status">{saving ? 'Saving images…' : status}</p>
      <div className="poi-image-grid">{images.map((image, index) => <figure key={image.id}
        className={`poi-image-tile${draggedId === image.id ? ' poi-image-tile--dragging' : ''}${dropTargetId === image.id ? ' poi-image-tile--drop-target' : ''}`}
        draggable={!saving} tabIndex={0} aria-label={`Reorder ${image.name}`}
        onDragStart={(event) => {
          event.dataTransfer.setData('application/x-poi-review-image', image.id);
          event.dataTransfer.effectAllowed = 'move';
          setDraggedId(image.id);
        }}
        onDragOver={(event) => {
          if (saving || !event.dataTransfer.types.includes('application/x-poi-review-image')) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setDropTargetId(image.id);
        }}
        onDrop={(event) => {
          event.preventDefault(); event.stopPropagation();
          const sourceId = event.dataTransfer.getData('application/x-poi-review-image');
          if (!saving && sourceId && sourceId !== image.id) onMove(sourceId, image.id);
          setDraggedId(null); setDropTargetId(null);
        }}
        onDragEnd={() => { setDraggedId(null); setDropTargetId(null); }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || !event.altKey || saving) return;
          const direction = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
          if (!direction) return;
          event.preventDefault();
          const target = images[index + direction];
          if (target) onMove(image.id, target.id);
        }}>
        <ReviewImage image={image} onRemove={() => onRemove(image.id)} />
      </figure>)}</div>
      {!images.length && <p>No images assigned. Drop files on this POI to add images.</p>}
    </div>
  </dialog>;
}

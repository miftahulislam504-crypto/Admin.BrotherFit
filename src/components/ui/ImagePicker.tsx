'use client';

import { useRef, useState } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import {
  fileToCompressedBase64,
  fileToIconBase64,
  getBase64SizeKB,
  MAX_IMAGE_KB_WARNING,
} from '@/lib/imageUtils';
import toast from 'react-hot-toast';

interface ImagePickerProps {
  images:     string[];
  onChange:   (images: string[]) => void;
  multiple?:  boolean;
  maxImages?: number;
  label?:     string;
  // ✅ Fix: new prop — when true, uses icon compression (128px)
  isIcon?:    boolean;
}

export default function ImagePicker({
  images,
  onChange,
  multiple  = true,
  maxImages = 6,
  label     = 'Choose from Gallery',
  isIcon    = false,   // ✅ default false
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const totalKB = images.reduce((sum, img) => sum + getBase64SizeKB(img), 0);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const remaining = maxImages - images.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${maxImages} image${maxImages > 1 ? 's' : ''} allowed`);
      return;
    }

    const files = Array.from(fileList).slice(0, remaining);
    setLoading(true);

    try {
      // ✅ Fix: use icon compressor when isIcon=true
      const compressed = await Promise.all(
        files.map(f => isIcon ? fileToIconBase64(f) : fileToCompressedBase64(f))
      );
      const next = multiple ? [...images, ...compressed] : compressed;

      const nextTotalKB = next.reduce((sum, img) => sum + getBase64SizeKB(img), 0);
      if (nextTotalKB > MAX_IMAGE_KB_WARNING) {
        toast.error('Images too large together — try fewer or smaller photos');
      }

      onChange(next);
    } catch {
      toast.error('Could not process one or more images');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeImage = (i: number) => onChange(images.filter((_, idx) => idx !== i));

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="sr-only"
        onChange={e => handleFiles(e.target.files)}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading || images.length >= maxImages}
          className="btn-outline disabled:opacity-50"
        >
          {loading
            ? <Loader2 size={15} className="animate-spin" />
            : <ImagePlus size={15} />}
          {loading ? 'Processing…' : label}
        </button>
        <span className="text-xs text-muted">
          {images.length}/{maxImages} · ~{totalKB} KB
        </span>
      </div>

      {images.length > 0 && (
        <div className={isIcon ? 'flex gap-2 mt-3' : 'grid grid-cols-4 gap-2 mt-3'}>
          {images.map((src, i) => (
            <div
              key={i}
              className={`relative group overflow-hidden bg-bg border border-border rounded-xl
                ${isIcon ? 'w-16 h-16' : 'aspect-square'}`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full
                           flex items-center justify-center opacity-0 group-hover:opacity-100
                           transition-opacity"
              >
                <X size={11} />
              </button>
              {i === 0 && multiple && !isIcon && (
                <span className="absolute bottom-1 left-1 text-[9px] bg-primary text-white px-1.5 py-0.5 rounded-md">
                  Main
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


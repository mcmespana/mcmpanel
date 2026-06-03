import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Button } from './button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Slider } from './slider';
import { Upload, X, Check, Loader2, ImageIcon, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCroppedImg, uploadImageToStorage } from '@/lib/imageUpload';
import { useToast } from '@/hooks/use-toast';

function isHeicFile(file: File) {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  );
}

async function convertHeicToJpeg(file: File): Promise<Blob> {
  // Lazy-load heic2any to avoid adding it to the main bundle
  const heic2any = (await import('heic2any')).default;
  const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 });
  return Array.isArray(result) ? result[0] : result;
}

interface ImageUploadCropperProps {
  value: string;
  onChange: (url: string) => void;
  storagePath: string;
  aspectRatio?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  className?: string;
}

export function ImageUploadCropper({
  value,
  onChange,
  storagePath,
  aspectRatio = 16 / 9,
  maxWidth = 1280,
  maxHeight = 720,
  quality = 0.82,
  className,
}: ImageUploadCropperProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const onCropComplete = useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const processFile = async (file: File) => {
    const validImage = file.type.startsWith('image/') || isHeicFile(file);
    if (!validImage) {
      toast({ title: 'Formato inválido', description: 'Selecciona una imagen (JPG, PNG, WebP, HEIC…)', variant: 'destructive' });
      return;
    }

    let blob: Blob = file;

    if (isHeicFile(file)) {
      setConverting(true);
      try {
        blob = await convertHeicToJpeg(file);
      } catch {
        toast({ title: 'Error HEIC', description: 'No se pudo convertir la imagen. Intenta con JPG/PNG.', variant: 'destructive' });
        setConverting(false);
        return;
      } finally {
        setConverting(false);
      }
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(blob);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await processFile(file);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  const handleConfirmCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setUploading(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, {
        maxWidth,
        maxHeight,
        quality,
        format: 'webp',
      });

      const filename = `${Date.now()}.webp`;
      const url = await uploadImageToStorage(blob, storagePath, filename);
      onChange(url);
      setImageSrc(null);

      const kb = Math.round(blob.size / 1024);
      toast({ title: 'Imagen subida', description: `${kb} KB · guardada en Storage` });
    } catch (err) {
      toast({
        title: 'Error al subir',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  return (
    <>
      <div className={cn('space-y-2', className)}>
        <div
          className={cn(
            'relative w-full rounded-lg overflow-hidden bg-muted/30 border cursor-pointer transition-colors group',
            isDragging
              ? 'border-primary border-dashed bg-primary/10'
              : 'border-border/50 hover:border-primary/50',
          )}
          style={{ aspectRatio: String(aspectRatio) }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          aria-label={value ? 'Cambiar imagen' : 'Subir imagen'}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-4">
              <ImageIcon className="w-8 h-8 opacity-40" />
              <span className="text-xs">{isDragging ? 'Suelta la imagen aquí' : 'Haz clic o arrastra una imagen'}</span>
            </div>
          )}
          <div className={cn(
            'absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity',
            isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}>
            {converting ? (
              <div className="flex flex-col items-center gap-1 text-white">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-xs font-medium">Convirtiendo HEIC…</span>
              </div>
            ) : isDragging ? (
              <div className="flex flex-col items-center gap-1 text-white">
                <Upload className="w-6 h-6" />
                <span className="text-xs font-medium">Suelta aquí</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-white">
                <Upload className="w-6 h-6" />
                <span className="text-xs font-medium">{value ? 'Cambiar imagen' : 'Subir imagen'}</span>
              </div>
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      <Dialog open={!!imageSrc} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent
          className="max-w-2xl"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Recortar y optimizar imagen
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div
              className="relative w-full bg-black rounded-lg overflow-hidden"
              style={{ height: 320 }}
            >
              {imageSrc && (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspectRatio}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  showGrid
                />
              )}
            </div>

            <div className="flex items-center gap-3 px-1">
              <span className="text-xs text-muted-foreground min-w-[3rem]">Zoom</span>
              <Slider
                min={1}
                max={3}
                step={0.01}
                value={[zoom]}
                onValueChange={([v]) => setZoom(v)}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
                onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); }}
                title="Restablecer"
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground px-1">
              La imagen se guardará como WebP optimizado ({maxWidth}×{maxHeight}px máx.).
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={handleCancel} disabled={uploading}>
                <X className="w-4 h-4 mr-1" />
                Cancelar
              </Button>
              <Button onClick={handleConfirmCrop} disabled={uploading} className="tech-glow">
                {uploading ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Subiendo...</>
                ) : (
                  <><Check className="w-4 h-4 mr-1" />Confirmar y subir</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useCallback, useRef, useState } from 'react';

export interface DroppedFile {

  absolutePath: string;
  name: string;
  bytes: Uint8Array;
}

export interface DropzoneProps {
  onFiles: (files: DroppedFile[]) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function Dropzone({ onFiles, disabled, children }: DropzoneProps) {
  const [dragging, setDragging] = useState(false);

  const depth = useRef(0);

  const handleDragEnter = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (disabled) return;
      depth.current += 1;
      setDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    depth.current -= 1;
    if (depth.current <= 0) {
      depth.current = 0;
      setDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      if (disabled) return;

      const dropped: DroppedFile[] = [];

      for (const file of Array.from(event.dataTransfer.files)) {
        const absolutePath = window.desktop.getPathForFile(file);
        if (!absolutePath) continue;

        try {

          const { name, bytes } = await window.desktop.readAbsolute(absolutePath);
          dropped.push({ absolutePath, name, bytes });
        } catch {
        }
      }

      if (dropped.length > 0) onFiles(dropped);
    },
    [disabled, onFiles],
  );

  return (
    <div
      className={dragging ? 'dr-dropzone is-dragging' : 'dr-dropzone'}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
}

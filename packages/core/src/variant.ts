export const VARIANT_TYPE_EXTENSIONS = ['.cs', '.jpg'] as const;

export const VARIANT_FILTER_EXTENSIONS = ['.xml', '.png'] as const;

export const PREVIEW_TEXT_EXTENSIONS = ['.cs', '.xml'] as const;

export const PREVIEW_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'] as const;

export type PreviewKind = 'text' | 'image' | 'unsupported';

export function extensionOf(fileName: string): string {
  const base = fileName.slice(fileName.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');

  return dot <= 0 ? '' : base.slice(dot).toLowerCase();
}

export function detectPreviewKind(fileName: string): PreviewKind {
  const ext = extensionOf(fileName);
  if ((PREVIEW_TEXT_EXTENSIONS as readonly string[]).includes(ext)) return 'text';
  if ((PREVIEW_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) return 'image';
  return 'unsupported';
}

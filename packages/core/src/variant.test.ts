import { describe, it, expect } from 'vitest';
import {
  extensionOf,
  detectPreviewKind,
  VARIANT_TYPE_EXTENSIONS,
  VARIANT_FILTER_EXTENSIONS,
} from './variant.js';
import { resolveMimeType } from './mime.js';

describe('Розширення файлу: extensionOf', () => {
  it('повертає розширення з крапкою', () => {
    expect(extensionOf('Program.cs')).toBe('.cs');
    expect(extensionOf('schema.xml')).toBe('.xml');
  });

  it('переводить розширення у нижній регістр', () => {
    expect(extensionOf('Program.CS')).toBe('.cs');
    expect(extensionOf('ICON.PnG')).toBe('.png');
    expect(extensionOf('PHOTO.JPEG')).toBe('.jpeg');
  });

  it('береться лише остання крапка у складеному розширенні', () => {
    expect(extensionOf('archive.tar.gz')).toBe('.gz');
    expect(extensionOf('report.xml.bak')).toBe('.bak');
  });

  it('працює для повного шляху — розширення шукається лише в назві файлу', () => {
    expect(extensionOf('A/B/Program.CS')).toBe('.cs');
    expect(extensionOf('assets/img/banner.png')).toBe('.png');
  });

  it('не бере розширення з назви папки, якщо сам файл його не має', () => {
    expect(extensionOf('my.folder/LICENSE')).toBe('');
  });

  it('файл без розширення дає порожній рядок', () => {
    expect(extensionOf('LICENSE')).toBe('');
    expect(extensionOf('Makefile')).toBe('');
  });

  it('прихований файл з початковою крапкою (.gitignore) дає порожній рядок, а не «.gitignore»', () => {
    expect(extensionOf('.gitignore')).toBe('');
    expect(extensionOf('config/.env')).toBe('');
  });

  it('прихований файл, що все ж має розширення, обробляється правильно', () => {
    expect(extensionOf('.eslintrc.json')).toBe('.json');
  });

  it('порожня назва дає порожній рядок', () => {
    expect(extensionOf('')).toBe('');
  });
});

describe('Константи варіанту 41', () => {
  it('блок ТИПИ містить саме .cs та .jpg', () => {
    expect(VARIANT_TYPE_EXTENSIONS).toEqual(['.cs', '.jpg']);
  });

  it('блок ОПЕРАЦІЇ (фільтр) містить саме .xml та .png', () => {
    expect(VARIANT_FILTER_EXTENSIONS).toEqual(['.xml', '.png']);
  });
});

describe('Спосіб відображення файлу: detectPreviewKind', () => {
  it('.cs показується як текст', () => {
    expect(detectPreviewKind('Program.cs')).toBe('text');
  });

  it('.xml показується як текст', () => {
    expect(detectPreviewKind('schema.xml')).toBe('text');
  });

  it('.jpg показується як зображення', () => {
    expect(detectPreviewKind('photo.jpg')).toBe('image');
  });

  it('.jpeg показується як зображення — це той самий формат, що й .jpg', () => {
    expect(detectPreviewKind('photo.jpeg')).toBe('image');
  });

  it('.png показується як зображення', () => {
    expect(detectPreviewKind('logo.png')).toBe('image');
  });

  it('нечутливий до регістру розширення', () => {
    expect(detectPreviewKind('MAIN.CS')).toBe('text');
    expect(detectPreviewKind('LOGO.PNG')).toBe('image');
  });

  it('працює для файлів у вкладених папках', () => {
    expect(detectPreviewKind('src/models/User.cs')).toBe('text');
    expect(detectPreviewKind('assets/img/banner.png')).toBe('image');
  });

  it('невідомі типи позначаються як unsupported', () => {
    expect(detectPreviewKind('archive.zip')).toBe('unsupported');
    expect(detectPreviewKind('report.pdf')).toBe('unsupported');
    expect(detectPreviewKind('notes.txt')).toBe('unsupported');
  });

  it('файл без розширення позначається як unsupported', () => {
    expect(detectPreviewKind('LICENSE')).toBe('unsupported');
    expect(detectPreviewKind('.gitignore')).toBe('unsupported');
  });

  it('усі розширення з блоків ТИПИ і ФІЛЬТР варіанту 41 мають робоче прев’ю', () => {
    for (const ext of [...VARIANT_TYPE_EXTENSIONS, ...VARIANT_FILTER_EXTENSIONS]) {
      expect(detectPreviewKind(`file${ext}`)).not.toBe('unsupported');
    }
  });
});

describe('Визначення MIME-типу: resolveMimeType', () => {
  it('визначає тип за розширенням, коли клієнт типу не надіслав', () => {
    expect(resolveMimeType('Program.cs')).toBe('text/x-csharp');
    expect(resolveMimeType('schema.xml')).toBe('application/xml');
    expect(resolveMimeType('logo.png')).toBe('image/png');
    expect(resolveMimeType('photo.jpg')).toBe('image/jpeg');
    expect(resolveMimeType('photo.jpeg')).toBe('image/jpeg');
  });

  it('визначає тип за розширенням у верхньому регістрі та за повним шляхом', () => {
    expect(resolveMimeType('SRC/MAIN.CS')).toBe('text/x-csharp');
  });

  it('тип, надісланий клієнтом, має пріоритет над визначеним за розширенням', () => {
    expect(resolveMimeType('data.xml', 'text/xml')).toBe('text/xml');
    expect(resolveMimeType('notes.txt', 'text/markdown')).toBe('text/markdown');
  });

  it('«загальний» application/octet-stream від клієнта замінюється типом за розширенням', () => {
    expect(resolveMimeType('Program.cs', 'application/octet-stream')).toBe('text/x-csharp');
    expect(resolveMimeType('schema.xml', 'application/octet-stream')).toBe('application/xml');
  });

  it('інші «загальні» типи (binary/octet-stream, application/x-msdownload) також замінюються', () => {
    expect(resolveMimeType('logo.png', 'binary/octet-stream')).toBe('image/png');
    expect(resolveMimeType('Program.cs', 'application/x-msdownload')).toBe('text/x-csharp');
  });

  it('«загальний» тип розпізнається незалежно від регістру', () => {
    expect(resolveMimeType('logo.png', 'APPLICATION/OCTET-STREAM')).toBe('image/png');
  });

  it('порожній рядок від клієнта трактується як відсутність типу', () => {
    expect(resolveMimeType('schema.xml', '')).toBe('application/xml');
  });

  it('для невідомого розширення без підказки клієнта повертається application/octet-stream', () => {
    expect(resolveMimeType('archive.unknownext')).toBe('application/octet-stream');
    expect(resolveMimeType('LICENSE')).toBe('application/octet-stream');
  });

  it('для невідомого розширення конкретний тип від клієнта зберігається', () => {
    expect(resolveMimeType('data.bin', 'application/vnd.custom')).toBe('application/vnd.custom');
  });
});

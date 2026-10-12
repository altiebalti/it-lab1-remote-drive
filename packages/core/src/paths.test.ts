import { describe, it, expect } from 'vitest';
import {
  normalizeRelativePath,
  baseName,
  dirName,
  InvalidPathError,
  MAX_SEGMENT_LENGTH,
} from './paths.js';

describe('Нормалізація шляхів: normalizeRelativePath', () => {
  describe('коректні шляхи зводяться до канонічного вигляду', () => {
    it('залишає без змін уже канонічний шлях', () => {
      expect(normalizeRelativePath('src/Program.cs')).toBe('src/Program.cs');
    });

    it('прибирає початковий слеш — шлях завжди відносний до кореня диска', () => {
      expect(normalizeRelativePath('/src/Program.cs')).toBe('src/Program.cs');
    });

    it('стискає повторні слеші', () => {
      expect(normalizeRelativePath('src//nested///data.xml')).toBe('src/nested/data.xml');
    });

    it('прибирає сегменти «.» (поточна папка)', () => {
      expect(normalizeRelativePath('src/./a/./Program.cs')).toBe('src/a/Program.cs');
    });

    it('прибирає пробіли на початку і в кінці шляху та навколо кожного сегмента', () => {
      expect(normalizeRelativePath('  /src// Program.cs ')).toBe('src/Program.cs');
      expect(normalizeRelativePath('src / nested /data.xml')).toBe('src/nested/data.xml');
    });

    it('зводить зворотні слеші Windows до прямих', () => {
      expect(normalizeRelativePath('src\\nested\\Program.cs')).toBe('src/nested/Program.cs');
      expect(normalizeRelativePath('C\\\\docs\\\\note.txt')).toBe('C/docs/note.txt');
    });

    it('зберігає кирилицю та пробіли всередині назв файлів і папок', () => {
      expect(normalizeRelativePath('Мої документи/Звіт етапу 2.xml')).toBe(
        'Мої документи/Звіт етапу 2.xml',
      );
    });

    it('зберігає регістр назв — нормалізація не переводить шлях у нижній регістр', () => {
      expect(normalizeRelativePath('Src/Program.CS')).toBe('Src/Program.CS');
    });

    it('приймає назву файлу без папок', () => {
      expect(normalizeRelativePath('logo.png')).toBe('logo.png');
    });

    it('приймає прихований файл із початковою крапкою', () => {
      expect(normalizeRelativePath('/.gitignore')).toBe('.gitignore');
    });

    it('приймає сегмент максимально допустимої довжини', () => {
      const longName = 'x'.repeat(MAX_SEGMENT_LENGTH);

      expect(normalizeRelativePath(`src/${longName}`)).toBe(`src/${longName}`);
    });

    it('є ідемпотентною: повторна нормалізація не змінює результат', () => {
      const once = normalizeRelativePath('  //src/./ nested //a.xml ');
      const twice = normalizeRelativePath(once);

      expect(once).toBe('src/nested/a.xml');
      expect(twice).toBe(once);
    });
  });

  describe('шляхи, що відхиляються з InvalidPathError', () => {
    const expectRejected = (input: string) => {
      expect(() => normalizeRelativePath(input)).toThrow(InvalidPathError);
    };

    it('«..» на початку шляху — спроба виходу за межі кореня', () => {
      expectRejected('../secret.xml');
      expect(() => normalizeRelativePath('../../etc/passwd')).toThrow(
        /за межі кореня/,
      );
    });

    it('«..» у середині шляху також відхиляється, а не «розгортається»', () => {
      expectRejected('src/../../etc/passwd');
      expectRejected('src/nested/../a.xml');
    });

    it('«..» у кінці шляху відхиляється', () => {
      expectRejected('src/nested/..');
    });

    it('«..», записане через зворотні слеші Windows, теж відхиляється', () => {
      expectRejected('..\\..\\secret.xml');
    });

    it('порожній рядок відхиляється', () => {
      expectRejected('');
      expect(() => normalizeRelativePath('')).toThrow(/порожнім/);
    });

    it('рядок лише з пробілів відхиляється', () => {
      expectRejected('   ');
    });

    it('шлях лише зі слешів не містить назви файлу і відхиляється', () => {
      expectRejected('/');
      expectRejected('///');
      expect(() => normalizeRelativePath('/')).toThrow(/не містить назви файлу/);
    });

    it('шлях лише з «.» не містить назви файлу і відхиляється', () => {
      expectRejected('.');
      expectRejected('./././');
    });

    it('керівні символи у назві відхиляються', () => {
      expectRejected('src/bad\u0000name.xml');
      expectRejected('src/bad\u001fname.xml');
      expectRejected('src/na\tme.xml');
    });

    it('заборонені на Windows символи у назві відхиляються', () => {
      for (const ch of ['<', '>', ':', '"', '|', '?', '*']) {
        expect(() => normalizeRelativePath(`src/na${ch}me.xml`)).toThrow(InvalidPathError);
      }
    });

    it('повідомлення про заборонений символ містить проблемний сегмент', () => {
      expect(() => normalizeRelativePath('src/na?me.xml')).toThrow(/na\?me\.xml/);
    });

    it('задовгий сегмент (понад MAX_SEGMENT_LENGTH) відхиляється', () => {
      const tooLong = 'x'.repeat(MAX_SEGMENT_LENGTH + 1);

      expect(() => normalizeRelativePath(`src/${tooLong}`)).toThrow(/задовга/);
    });

    it('помилка має ім’я «InvalidPathError» — за ним API відрізняє її від внутрішніх збоїв', () => {
      try {
        normalizeRelativePath('../secret.xml');
        expect.unreachable('очікувалась помилка InvalidPathError');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidPathError);
        expect((error as Error).name).toBe('InvalidPathError');
      }
    });
  });
});

describe('Допоміжні функції шляху: baseName і dirName', () => {
  it('baseName повертає останню складову шляху', () => {
    expect(baseName('src/nested/Program.cs')).toBe('Program.cs');
  });

  it('baseName для шляху без папок повертає сам шлях', () => {
    expect(baseName('Program.cs')).toBe('Program.cs');
  });

  it('dirName повертає батьківську папку', () => {
    expect(dirName('src/a/Program.cs')).toBe('src/a');
  });

  it('dirName для файлу в корені повертає порожній рядок', () => {
    expect(dirName('Program.cs')).toBe('');
  });

  it('baseName і dirName разом відтворюють початковий шлях', () => {
    const path = normalizeRelativePath('src//nested/./data.xml');

    expect(`${dirName(path)}/${baseName(path)}`).toBe(path);
  });
});

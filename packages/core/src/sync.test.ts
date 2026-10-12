import { describe, it, expect } from 'vitest';
import {
  computeSyncPlan,
  conflictCopyPath,
  type LocalFileState,
  type RemoteFileState,
  type SyncIndexEntry,
} from './sync.js';

const local = (path: string, contentHash: string): LocalFileState => ({ path, contentHash });

const remote = (path: string, contentHash: string, id = `remote-${path}`): RemoteFileState => ({
  id,
  path,
  contentHash,
});

const indexed = (
  path: string,
  contentHash: string,
  remoteId = `remote-${path}`,
): SyncIndexEntry => ({ path, contentHash, remoteId });

describe('Рушій синхронізації: computeSyncPlan', () => {
  describe('файл присутній лише з одного боку', () => {
    it('новий локальний файл (немає ні на сервері, ні в індексі) → upload з причиною «new-local»', () => {
      const plan = computeSyncPlan([local('notes.xml', 'h1')], [], []);

      expect(plan.actions).toEqual([{ type: 'upload', path: 'notes.xml', reason: 'new-local' }]);
    });

    it('новий віддалений файл (немає ні локально, ні в індексі) → download з причиною «new-remote»', () => {
      const plan = computeSyncPlan([], [remote('logo.png', 'h1', 'r-42')], []);

      expect(plan.actions).toEqual([
        { type: 'download', path: 'logo.png', remoteId: 'r-42', reason: 'new-remote' },
      ]);
    });

    it('файл є локально та в індексі, але зник із сервера → delete-local (видалений віддалено)', () => {
      const plan = computeSyncPlan(
        [local('old.xml', 'h1')],
        [],
        [indexed('old.xml', 'h1', 'r-7')],
      );

      expect(plan.actions).toEqual([{ type: 'delete-local', path: 'old.xml' }]);
    });

    it('файл є на сервері та в індексі, але зник локально → delete-remote (видалений локально)', () => {
      const plan = computeSyncPlan(
        [],
        [remote('old.png', 'h1', 'r-9')],
        [indexed('old.png', 'h1', 'r-9')],
      );

      expect(plan.actions).toEqual([{ type: 'delete-remote', path: 'old.png', remoteId: 'r-9' }]);
    });

    it('файл є лише в індексі (зник з обох боків) → жодної дії не генерується', () => {
      const plan = computeSyncPlan([], [], [indexed('gone.xml', 'h1')]);

      expect(plan.actions).toEqual([]);
      expect(plan.changes).toEqual([]);
    });

    it('delete-local вибирається саме за наявністю індексу: без індексу той самий вхід дає upload', () => {
      const withIndex = computeSyncPlan([local('a.xml', 'h1')], [], [indexed('a.xml', 'h1')]);
      const withoutIndex = computeSyncPlan([local('a.xml', 'h1')], [], []);

      expect(withIndex.actions[0].type).toBe('delete-local');
      expect(withoutIndex.actions[0].type).toBe('upload');
    });
  });

  describe('файл присутній з обох боків', () => {
    it('однаковий вміст локально та на сервері → up-to-date', () => {
      const plan = computeSyncPlan([local('same.xml', 'h1')], [remote('same.xml', 'h1')], []);

      expect(plan.actions).toEqual([{ type: 'up-to-date', path: 'same.xml' }]);
    });

    it('однаковий вміст визнається up-to-date навіть за наявності індексу з іншим хешем', () => {
      const plan = computeSyncPlan(
        [local('same.xml', 'h2')],
        [remote('same.xml', 'h2')],
        [indexed('same.xml', 'h1')],
      );

      expect(plan.actions).toEqual([{ type: 'up-to-date', path: 'same.xml' }]);
    });

    it('різний вміст і немає індексу (перша синхронізація) → conflict, нічого не затирається', () => {
      const plan = computeSyncPlan(
        [local('doc.xml', 'local-hash')],
        [remote('doc.xml', 'remote-hash', 'r-1')],
        [],
      );

      expect(plan.actions).toEqual([{ type: 'conflict', path: 'doc.xml', remoteId: 'r-1' }]);
    });

    it('змінений лише локально (віддалений хеш = хеш з індексу) → upload з причиною «local-modified»', () => {
      const plan = computeSyncPlan(
        [local('doc.xml', 'new-local')],
        [remote('doc.xml', 'base', 'r-1')],
        [indexed('doc.xml', 'base', 'r-1')],
      );

      expect(plan.actions).toEqual([
        { type: 'upload', path: 'doc.xml', reason: 'local-modified' },
      ]);
    });

    it('змінений лише віддалено (локальний хеш = хеш з індексу) → download з причиною «remote-modified»', () => {
      const plan = computeSyncPlan(
        [local('doc.xml', 'base')],
        [remote('doc.xml', 'new-remote', 'r-1')],
        [indexed('doc.xml', 'base', 'r-1')],
      );

      expect(plan.actions).toEqual([
        { type: 'download', path: 'doc.xml', remoteId: 'r-1', reason: 'remote-modified' },
      ]);
    });

    it('змінений з обох боків по-різному → conflict', () => {
      const plan = computeSyncPlan(
        [local('doc.xml', 'new-local')],
        [remote('doc.xml', 'new-remote', 'r-1')],
        [indexed('doc.xml', 'base', 'r-1')],
      );

      expect(plan.actions).toEqual([{ type: 'conflict', path: 'doc.xml', remoteId: 'r-1' }]);
    });

    it('конфлікт містить remoteId, щоб клієнт міг завантажити віддалену версію для копії', () => {
      const plan = computeSyncPlan(
        [local('doc.xml', 'new-local')],
        [remote('doc.xml', 'new-remote', 'r-777')],
        [indexed('doc.xml', 'base', 'r-777')],
      );

      expect(plan.actions[0]).toMatchObject({ type: 'conflict', remoteId: 'r-777' });
    });
  });

  describe('поле changes', () => {
    it('не містить дій типу up-to-date', () => {
      const plan = computeSyncPlan(
        [local('same.xml', 'h1'), local('new.png', 'h2')],
        [remote('same.xml', 'h1')],
        [],
      );

      expect(plan.actions.map((a) => a.type).sort()).toEqual(['up-to-date', 'upload']);
      expect(plan.changes.map((a) => a.type)).toEqual(['upload']);
    });

    it('порожнє, якщо всі файли вже синхронізовані', () => {
      const plan = computeSyncPlan(
        [local('a.xml', 'h1'), local('b.png', 'h2')],
        [remote('a.xml', 'h1'), remote('b.png', 'h2')],
        [indexed('a.xml', 'h1'), indexed('b.png', 'h2')],
      );

      expect(plan.changes).toEqual([]);
      expect(plan.actions).toHaveLength(2);
    });

    it('повністю порожній план для порожніх входів', () => {
      const plan = computeSyncPlan([], [], []);

      expect(plan.actions).toEqual([]);
      expect(plan.changes).toEqual([]);
    });
  });

  describe('змішаний сценарій із кількома файлами одночасно', () => {
    it('для кожного шляху обирає власну дію і повертає їх упорядкованими за шляхом', () => {
      const plan = computeSyncPlan(
        [
          local('a-new-local.xml', 'h-new'),
          local('c-same.xml', 'h-same'),
          local('d-local-modified.cs', 'h-local-new'),
          local('e-conflict.xml', 'h-local-new'),
          local('f-deleted-remote.png', 'h-base'),
        ],
        [
          remote('b-new-remote.png', 'h-new', 'r-b'),
          remote('c-same.xml', 'h-same', 'r-c'),
          remote('d-local-modified.cs', 'h-base', 'r-d'),
          remote('e-conflict.xml', 'h-remote-new', 'r-e'),
          remote('g-deleted-local.xml', 'h-base', 'r-g'),
        ],
        [
          indexed('c-same.xml', 'h-same', 'r-c'),
          indexed('d-local-modified.cs', 'h-base', 'r-d'),
          indexed('e-conflict.xml', 'h-base', 'r-e'),
          indexed('f-deleted-remote.png', 'h-base', 'r-f'),
          indexed('g-deleted-local.xml', 'h-base', 'r-g'),
        ],
      );

      expect(plan.actions).toEqual([
        { type: 'upload', path: 'a-new-local.xml', reason: 'new-local' },
        { type: 'download', path: 'b-new-remote.png', remoteId: 'r-b', reason: 'new-remote' },
        { type: 'up-to-date', path: 'c-same.xml' },
        { type: 'upload', path: 'd-local-modified.cs', reason: 'local-modified' },
        { type: 'conflict', path: 'e-conflict.xml', remoteId: 'r-e' },
        { type: 'delete-local', path: 'f-deleted-remote.png' },
        { type: 'delete-remote', path: 'g-deleted-local.xml', remoteId: 'r-g' },
      ]);
      expect(plan.changes).toHaveLength(6);
    });

    it('шлях, що зник з обох боків, не з’являється у плані серед інших файлів', () => {
      const plan = computeSyncPlan(
        [local('keep.xml', 'h1')],
        [remote('keep.xml', 'h1')],
        [indexed('keep.xml', 'h1'), indexed('vanished.png', 'h9')],
      );

      expect(plan.actions.map((a) => a.path)).toEqual(['keep.xml']);
    });
  });
});

describe('Ім’я копії при конфлікті: conflictCopyPath', () => {
  it('вставляє позначку перед розширенням для файлу у вкладеній папці', () => {
    expect(conflictCopyPath('src/Program.cs')).toBe('src/Program (конфлікт).cs');
  });

  it('працює для файлу в корені диска', () => {
    expect(conflictCopyPath('schema.xml')).toBe('schema (конфлікт).xml');
  });

  it('зберігає повний шлях із кількох рівнів папок', () => {
    expect(conflictCopyPath('a/b/c/logo.png')).toBe('a/b/c/logo (конфлікт).png');
  });

  it('файл без розширення отримує позначку в кінці назви', () => {
    expect(conflictCopyPath('LICENSE')).toBe('LICENSE (конфлікт)');
    expect(conflictCopyPath('docs/README')).toBe('docs/README (конфлікт)');
  });

  it('прихований файл без розширення (.gitignore) не «розрізається» по початковій крапці', () => {
    expect(conflictCopyPath('.gitignore')).toBe('.gitignore (конфлікт)');
    expect(conflictCopyPath('config/.gitignore')).toBe('config/.gitignore (конфлікт)');
  });

  it('для складеного розширення враховується лише остання крапка', () => {
    expect(conflictCopyPath('archive.tar.gz')).toBe('archive.tar (конфлікт).gz');
  });

  it('не змінює назву папки у шляху, навіть якщо вона містить крапку', () => {
    expect(conflictCopyPath('my.folder/notes.xml')).toBe('my.folder/notes (конфлікт).xml');
  });
});

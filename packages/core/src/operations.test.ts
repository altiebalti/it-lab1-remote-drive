import { describe, it, expect } from 'vitest';
import {
  sortByCreatedAt,
  filterByVariant,
  applyVariantOperation,
  type SortableByCreation,
  type FileFilter,
} from './operations.js';

interface TestFile extends SortableByCreation {
  name: string;
  createdAt: string | Date;
}

const file = (name: string, createdAt: string | Date): TestFile => ({ name, createdAt });

const MIXED_DATES: TestFile[] = [
  file('schema.xml', '2024-03-15T10:30:00.000Z'),
  file('Program.cs', '2024-01-01T08:00:00.000Z'),
  file('logo.png', '2024-06-20T23:59:59.000Z'),
  file('photo.jpg', '2024-02-10T12:00:00.000Z'),
];

const names = (files: readonly TestFile[]): string[] => files.map((f) => f.name);

describe('Індивідуальна операція варіанту 41: сортування за датою створення та фільтр .xml/.png', () => {
  describe('sortByCreatedAt — сортування за датою і часом створення', () => {
    it('сортує за зростанням дати створення: від найстарішого файлу до найновішого', () => {
      const result = sortByCreatedAt(MIXED_DATES, 'asc');

      expect(names(result)).toEqual(['Program.cs', 'photo.jpg', 'schema.xml', 'logo.png']);
    });

    it('сортує за спаданням дати створення: від найновішого файлу до найстарішого', () => {
      const result = sortByCreatedAt(MIXED_DATES, 'desc');

      expect(names(result)).toEqual(['logo.png', 'schema.xml', 'photo.jpg', 'Program.cs']);
    });

    it('спадний порядок є точним оберненням зростаючого, коли всі дати різні', () => {
      const asc = names(sortByCreatedAt(MIXED_DATES, 'asc'));
      const desc = names(sortByCreatedAt(MIXED_DATES, 'desc'));

      expect(desc).toEqual([...asc].reverse());
    });

    it('враховує час, а не лише дату: файли, створені в межах однієї доби, впорядковуються за годинами', () => {
      const sameDay: TestFile[] = [
        file('evening.xml', '2024-05-05T21:15:00.000Z'),
        file('morning.xml', '2024-05-05T07:05:00.000Z'),
        file('noon.xml', '2024-05-05T12:00:00.000Z'),
      ];

      expect(names(sortByCreatedAt(sameDay, 'asc'))).toEqual([
        'morning.xml',
        'noon.xml',
        'evening.xml',
      ]);
      expect(names(sortByCreatedAt(sameDay, 'desc'))).toEqual([
        'evening.xml',
        'noon.xml',
        'morning.xml',
      ]);
    });

    it('розрізняє файли з точністю до мілісекунд', () => {
      const closeInTime: TestFile[] = [
        file('second.png', '2024-05-05T12:00:00.002Z'),
        file('first.png', '2024-05-05T12:00:00.001Z'),
      ];

      expect(names(sortByCreatedAt(closeInTime, 'asc'))).toEqual(['first.png', 'second.png']);
    });

    describe('вторинне впорядкування за назвою при однаковій даті створення', () => {
      const SAME_DATE = '2024-04-01T00:00:00.000Z';
      const sameMoment: TestFile[] = [
        file('zebra.xml', SAME_DATE),
        file('alpha.xml', SAME_DATE),
        file('moon.xml', SAME_DATE),
      ];

      it('за однакової дати впорядковує за назвою за зростанням (режим asc)', () => {
        expect(names(sortByCreatedAt(sameMoment, 'asc'))).toEqual([
          'alpha.xml',
          'moon.xml',
          'zebra.xml',
        ]);
      });

      it('вторинне впорядкування за назвою НЕ перевертається у режимі desc — воно завжди зростаюче', () => {
        expect(names(sortByCreatedAt(sameMoment, 'desc'))).toEqual([
          'alpha.xml',
          'moon.xml',
          'zebra.xml',
        ]);
      });

      it('у змішаному наборі напрям за датою перевертається, а пара з однаковою датою лишається у тому ж порядку', () => {
        const mixed: TestFile[] = [
          file('newer.png', '2024-09-09T00:00:00.000Z'),
          file('b.xml', SAME_DATE),
          file('a.xml', SAME_DATE),
          file('older.png', '2024-01-01T00:00:00.000Z'),
        ];

        expect(names(sortByCreatedAt(mixed, 'asc'))).toEqual([
          'older.png',
          'a.xml',
          'b.xml',
          'newer.png',
        ]);

        expect(names(sortByCreatedAt(mixed, 'desc'))).toEqual([
          'newer.png',
          'a.xml',
          'b.xml',
          'older.png',
        ]);
      });

      it('результат детермінований: не залежить від початкового порядку вхідного масиву', () => {
        const forward = names(sortByCreatedAt(sameMoment, 'asc'));
        const backward = names(sortByCreatedAt([...sameMoment].reverse(), 'asc'));

        expect(backward).toEqual(forward);
      });
    });

    it('не мутує вхідний масив — повертає новий', () => {
      const input = [...MIXED_DATES];
      const snapshot = names(input);

      const result = sortByCreatedAt(input, 'desc');

      expect(names(input)).toEqual(snapshot);
      expect(result).not.toBe(input);
    });

    it('приймає createdAt як об’єкт Date, так і як ISO-рядок, і дає однаковий результат', () => {
      const asStrings: TestFile[] = [
        file('b.xml', '2024-02-02T00:00:00.000Z'),
        file('a.xml', '2024-01-01T00:00:00.000Z'),
      ];
      const asDates: TestFile[] = [
        file('b.xml', new Date('2024-02-02T00:00:00.000Z')),
        file('a.xml', new Date('2024-01-01T00:00:00.000Z')),
      ];

      expect(names(sortByCreatedAt(asStrings, 'asc'))).toEqual(['a.xml', 'b.xml']);
      expect(names(sortByCreatedAt(asDates, 'asc'))).toEqual(['a.xml', 'b.xml']);
    });

    it('коректно сортує змішаний масив, де частина дат — Date, а частина — рядки', () => {
      const mixedTypes: TestFile[] = [
        file('third.png', new Date('2024-03-03T00:00:00.000Z')),
        file('first.png', '2024-01-01T00:00:00.000Z'),
        file('second.png', new Date('2024-02-02T00:00:00.000Z')),
      ];

      expect(names(sortByCreatedAt(mixedTypes, 'asc'))).toEqual([
        'first.png',
        'second.png',
        'third.png',
      ]);
    });

    it('повертає порожній масив для порожнього входу (обидва напрями)', () => {
      expect(sortByCreatedAt([], 'asc')).toEqual([]);
      expect(sortByCreatedAt([], 'desc')).toEqual([]);
    });

    it('масив з одного файлу повертається без змін', () => {
      const single = [file('only.xml', '2024-07-07T00:00:00.000Z')];

      expect(names(sortByCreatedAt(single, 'asc'))).toEqual(['only.xml']);
      expect(names(sortByCreatedAt(single, 'desc'))).toEqual(['only.xml']);
    });
  });

  describe('filterByVariant — фільтр «всі файли» / «лише .xml та .png»', () => {
    const CATALOG: TestFile[] = [
      file('schema.xml', '2024-01-01T00:00:00.000Z'),
      file('Program.cs', '2024-01-02T00:00:00.000Z'),
      file('logo.png', '2024-01-03T00:00:00.000Z'),
      file('photo.jpg', '2024-01-04T00:00:00.000Z'),
      file('notes.txt', '2024-01-05T00:00:00.000Z'),
    ];

    it('режим «all» повертає всі файли без винятку', () => {
      expect(names(filterByVariant(CATALOG, 'all'))).toEqual([
        'schema.xml',
        'Program.cs',
        'logo.png',
        'photo.jpg',
        'notes.txt',
      ]);
    });

    it('режим «all» не змінює порядок файлів і не мутує вхідний масив', () => {
      const input = [...CATALOG];
      const result = filterByVariant(input, 'all');

      expect(names(result)).toEqual(names(input));
      expect(result).not.toBe(input);
    });

    it('режим «variant» залишає лише файли типу .xml та .png', () => {
      expect(names(filterByVariant(CATALOG, 'variant'))).toEqual(['schema.xml', 'logo.png']);
    });

    it('режим «variant» відкидає типи, що не входять у фільтр варіанту (.cs, .jpg, .txt)', () => {
      const result = names(filterByVariant(CATALOG, 'variant'));

      expect(result).not.toContain('Program.cs');
      expect(result).not.toContain('photo.jpg');
      expect(result).not.toContain('notes.txt');
    });

    it('фільтр нечутливий до регістру розширення: SCHEMA.XML та ICON.PnG проходять', () => {
      const upperCase: TestFile[] = [
        file('SCHEMA.XML', '2024-01-01T00:00:00.000Z'),
        file('ICON.PnG', '2024-01-02T00:00:00.000Z'),
        file('MAIN.CS', '2024-01-03T00:00:00.000Z'),
      ];

      expect(names(filterByVariant(upperCase, 'variant'))).toEqual(['SCHEMA.XML', 'ICON.PnG']);
    });

    it('фільтр працює для файлів у вкладених папках — розширення береться з назви файлу, не зі шляху', () => {
      const nested: TestFile[] = [
        file('src/config/app.xml', '2024-01-01T00:00:00.000Z'),
        file('assets/img/banner.png', '2024-01-02T00:00:00.000Z'),
        file('src/xml/Main.cs', '2024-01-03T00:00:00.000Z'),
      ];

      expect(names(filterByVariant(nested, 'variant'))).toEqual([
        'src/config/app.xml',
        'assets/img/banner.png',
      ]);
    });

    it('файл без розширення і прихований файл (.gitignore) не проходять фільтр варіанту', () => {
      const tricky: TestFile[] = [
        file('LICENSE', '2024-01-01T00:00:00.000Z'),
        file('.gitignore', '2024-01-02T00:00:00.000Z'),
        file('ok.xml', '2024-01-03T00:00:00.000Z'),
      ];

      expect(names(filterByVariant(tricky, 'variant'))).toEqual(['ok.xml']);
    });

    it('не вважає розширенням збіг усередині назви: "report.xml.bak" відкидається', () => {
      const tricky: TestFile[] = [
        file('report.xml.bak', '2024-01-01T00:00:00.000Z'),
        file('report.xml', '2024-01-02T00:00:00.000Z'),
      ];

      expect(names(filterByVariant(tricky, 'variant'))).toEqual(['report.xml']);
    });

    it('повертає порожній масив, якщо жоден файл не відповідає фільтру', () => {
      const noMatches: TestFile[] = [
        file('Program.cs', '2024-01-01T00:00:00.000Z'),
        file('photo.jpg', '2024-01-02T00:00:00.000Z'),
      ];

      expect(filterByVariant(noMatches, 'variant')).toEqual([]);
    });

    it('повертає порожній масив для порожнього входу (обидва режими)', () => {
      expect(filterByVariant([], 'all')).toEqual([]);
      expect(filterByVariant([], 'variant')).toEqual([]);
    });
  });

  describe('applyVariantOperation — повна операція варіанту: фільтр разом із сортуванням', () => {

    const CATALOG: TestFile[] = [
      file('Program.cs', '2024-01-01T00:00:00.000Z'), // найстаріший, але не проходить фільтр
      file('schema.xml', '2024-02-01T00:00:00.000Z'),
      file('photo.jpg', '2024-03-01T00:00:00.000Z'),
      file('logo.png', '2024-04-01T00:00:00.000Z'),
      file('notes.txt', '2024-05-01T00:00:00.000Z'), // найновіший, але не проходить фільтр
    ];

    it('фільтр «variant» + порядок «asc»: лише .xml/.png, від найстарішого', () => {
      expect(names(applyVariantOperation(CATALOG, 'variant', 'asc'))).toEqual([
        'schema.xml',
        'logo.png',
      ]);
    });

    it('фільтр «variant» + порядок «desc»: лише .xml/.png, від найновішого', () => {
      expect(names(applyVariantOperation(CATALOG, 'variant', 'desc'))).toEqual([
        'logo.png',
        'schema.xml',
      ]);
    });

    it('фільтр «all» + порядок «asc»: усі файли від найстарішого', () => {
      expect(names(applyVariantOperation(CATALOG, 'all', 'asc'))).toEqual([
        'Program.cs',
        'schema.xml',
        'photo.jpg',
        'logo.png',
        'notes.txt',
      ]);
    });

    it('фільтр «all» + порядок «desc»: усі файли від найновішого', () => {
      expect(names(applyVariantOperation(CATALOG, 'all', 'desc'))).toEqual([
        'notes.txt',
        'logo.png',
        'photo.jpg',
        'schema.xml',
        'Program.cs',
      ]);
    });

    it('фільтр застосовується ДО сортування: відкинуті файли не потрапляють у результат навіть як крайні за датою', () => {
      const result = names(applyVariantOperation(CATALOG, 'variant', 'asc'));

      expect(result[0]).toBe('schema.xml');
      expect(result[result.length - 1]).toBe('logo.png');
      expect(result).toHaveLength(2);
    });

    it('результат ідентичний послідовному виклику filterByVariant, а потім sortByCreatedAt', () => {
      const combined = names(applyVariantOperation(CATALOG, 'variant', 'desc'));
      const stepByStep = names(sortByCreatedAt(filterByVariant(CATALOG, 'variant'), 'desc'));

      expect(combined).toEqual(stepByStep);
    });

    it('не мутує вхідний масив ні для однієї з чотирьох комбінацій фільтра і порядку', () => {
      const input = [...CATALOG];
      const snapshot = names(input);

      const combinations: Array<[FileFilter, 'asc' | 'desc']> = [
        ['all', 'asc'],
        ['all', 'desc'],
        ['variant', 'asc'],
        ['variant', 'desc'],
      ];
      for (const [filter, order] of combinations) {
        applyVariantOperation(input, filter, order);
      }

      expect(names(input)).toEqual(snapshot);
    });

    it('повертає порожній масив для порожнього входу за будь-якої комбінації параметрів', () => {
      expect(applyVariantOperation([], 'all', 'asc')).toEqual([]);
      expect(applyVariantOperation([], 'all', 'desc')).toEqual([]);
      expect(applyVariantOperation([], 'variant', 'asc')).toEqual([]);
      expect(applyVariantOperation([], 'variant', 'desc')).toEqual([]);
    });
  });
});

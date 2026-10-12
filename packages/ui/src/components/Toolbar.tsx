import type { FileFilter, SortOrder } from '@drive/core';
import { VARIANT_FILTER_EXTENSIONS } from '@drive/core';
import { countUk } from '../formatters.js';

export interface ToolbarProps {
  order: SortOrder;
  filter: FileFilter;
  onOrderChange: (order: SortOrder) => void;
  onFilterChange: (filter: FileFilter) => void;

  shown: number;
  total: number;
  busy?: boolean;
  children?: React.ReactNode;
}

export function Toolbar({
  order,
  filter,
  onOrderChange,
  onFilterChange,
  shown,
  total,
  busy,
  children,
}: ToolbarProps) {
  const filterLabel = VARIANT_FILTER_EXTENSIONS.join(', ');

  return (
    <div className="dr-toolbar">
      <div className="dr-toolbar__group">
        <span className="dr-toolbar__label">Сортування за датою створення</span>
        <div className="dr-segmented" role="group" aria-label="Порядок сортування">
          <button
            type="button"
            className={order === 'asc' ? 'is-active' : ''}
            aria-pressed={order === 'asc'}
            onClick={() => onOrderChange('asc')}
          >
            ↑ Зростання
          </button>
          <button
            type="button"
            className={order === 'desc' ? 'is-active' : ''}
            aria-pressed={order === 'desc'}
            onClick={() => onOrderChange('desc')}
          >
            ↓ Спадання
          </button>
        </div>
      </div>

      <div className="dr-toolbar__group">
        <span className="dr-toolbar__label">Фільтр</span>
        <div className="dr-segmented" role="group" aria-label="Фільтр за типом">
          <button
            type="button"
            className={filter === 'all' ? 'is-active' : ''}
            aria-pressed={filter === 'all'}
            onClick={() => onFilterChange('all')}
          >
            Усі файли
          </button>
          <button
            type="button"
            className={filter === 'variant' ? 'is-active' : ''}
            aria-pressed={filter === 'variant'}
            onClick={() => onFilterChange('variant')}
          >
            Лише {filterLabel}
          </button>
        </div>
      </div>

      <div className="dr-toolbar__spacer" />

      <span className="dr-toolbar__count">
        {busy
          ? 'Оновлення…'
          : shown === total
            ? countUk(total, 'файл', 'файли', 'файлів')
            : `${shown} з ${total}`}
      </span>

      {children}
    </div>
  );
}

import { useState } from 'react';
import {
  COLUMNS,
  setAllColumns,
  toggleColumn,
  type ColumnVisibility,
} from '../columns.js';

export interface ColumnToggleProps {
  visibility: ColumnVisibility;
  onChange: (visibility: ColumnVisibility) => void;
}

export function ColumnToggle({ visibility, onChange }: ColumnToggleProps) {
  const [open, setOpen] = useState(false);

  const hiddenCount = COLUMNS.filter(
    (c) => !c.alwaysVisible && !visibility[c.key],
  ).length;

  return (
    <div className="dr-columns">
      <button
        type="button"
        className="dr-button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Стовпці{hiddenCount > 0 ? ` (−${hiddenCount})` : ''}
      </button>

      {open && (
        <>
          {/* Клік поза списком закриває його. */}
          <div className="dr-columns__backdrop" onClick={() => setOpen(false)} />
          <div className="dr-columns__menu" role="menu">
            {COLUMNS.map((column) => (
              <label
                key={column.key}
                className={
                  column.alwaysVisible
                    ? 'dr-columns__item is-locked'
                    : 'dr-columns__item'
                }
                title={
                  column.alwaysVisible
                    ? 'Стовпець «Назва» приховати не можна'
                    : undefined
                }
              >
                <input
                  type="checkbox"
                  checked={column.alwaysVisible || visibility[column.key]}
                  disabled={column.alwaysVisible}
                  onChange={() => onChange(toggleColumn(visibility, column.key))}
                />
                <span>{column.label}</span>
                {column.alwaysVisible && <span className="dr-columns__lock">🔒</span>}
              </label>
            ))}

            <div className="dr-columns__actions">
              <button type="button" onClick={() => onChange(setAllColumns(true))}>
                Показати всі
              </button>
              <button type="button" onClick={() => onChange(setAllColumns(false))}>
                Приховати всі
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import type { SyncPlan } from '@drive/core';

export interface WebSyncState {
  supported: boolean;
  folderName: string | null;
  plan: SyncPlan | null;
  running: boolean;
  status: string;
  error: string | null;
}

export interface WebSyncPanelProps {
  state: WebSyncState;
  onChooseFolder: () => void;
  onPreview: () => void;
  onRun: () => void;
}

const LABELS: Record<string, string> = {
  upload: 'на сервер',
  download: 'з сервера',
  'delete-remote': 'видалити там',
  'delete-local': 'видалити тут',
  conflict: 'конфлікт',
};

export function WebSyncPanel({
  state,
  onChooseFolder,
  onPreview,
  onRun,
}: WebSyncPanelProps) {
  if (!state.supported) {
    return (
      <div className="wb-limits">
        <div className="wb-limits__row">
          <strong>Синхронізація недоступна.</strong>
          <span>
            Ваш браузер не підтримує File System Access API — доступ до папки на
            диску можливий лише в Chrome та похідних від нього браузерах.
            Завантаження та вивантаження окремих файлів працюють без обмежень.
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="wb-limits">
        <div className="wb-limits__row">
          <button type="button" className="dr-button" onClick={onChooseFolder}>
            {state.folderName ? 'Змінити папку' : 'Вибрати папку'}
          </button>

          {state.folderName ? (
            <strong>{state.folderName}</strong>
          ) : (
            <span>Папку для синхронізації не вибрано</span>
          )}

          {state.folderName && (
            <>
              <button
                type="button"
                className="dr-button"
                onClick={onPreview}
                disabled={state.running}
              >
                Порівняти
              </button>
              <button
                type="button"
                className="dr-button is-primary"
                onClick={onRun}
                disabled={state.running}
              >
                Синхронізувати
              </button>
            </>
          )}

          <span className="wb-header__spacer" />
          <span style={{ color: state.error ? 'var(--dr-danger)' : undefined }}>
            {state.error ?? state.status}
          </span>
        </div>

        {/* Обмеження названі прямо: у звіті етапу 4 вони є предметом порівняння */}
        <div className="wb-limits__row" style={{ marginTop: 6, fontSize: 12 }}>
          <span>
            Браузер не дозволяє відстежувати зміни у папці й не запам'ятовує
            дозвіл між сеансами, тому синхронізацію щоразу запускає користувач,
            а папку доводиться обирати заново.
          </span>
        </div>
      </div>

      {state.plan && state.plan.changes.length > 0 && (
        <div className="dr-plan" style={{ maxHeight: 190, overflow: 'auto' }}>
          {state.plan.changes.map((action, i) => (
            <div className="dr-plan__row" key={`${action.type}-${action.path}-${i}`}>
              <span className={`dr-plan__tag ${action.type}`}>
                {LABELS[action.type] ?? action.type}
              </span>
              <span>{action.path}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

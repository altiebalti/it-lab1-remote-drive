import type { SyncPlan } from '@drive/core';
import { describe, type SyncState } from '../useSync';

export interface SyncPanelProps {
  state: SyncState;
  onChooseFolder: () => void;
  onPreview: () => void;
  onRun: () => void;
  onToggleWatching: () => void;
}

export function SyncPanel({
  state,
  onChooseFolder,
  onPreview,
  onRun,
  onToggleWatching,
}: SyncPanelProps) {
  return (
    <>
      <div className="dk-sync">
        <button type="button" className="dr-button" onClick={onChooseFolder}>
          {state.folder ? 'Змінити папку' : 'Вибрати папку'}
        </button>

        {state.folder ? (
          <span className="dk-sync__folder" title={state.folder}>
            {state.folder}
          </span>
        ) : (
          <span className="dr-muted">Папку для синхронізації не вибрано</span>
        )}

        {state.folder && (
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

            <label className="dk-sync__watch">
              <input
                type="checkbox"
                checked={state.watching}
                onChange={onToggleWatching}
              />
              Відстежувати зміни
            </label>
          </>
        )}

        <span className="dk-sync__spacer" />

        <span className={state.error ? 'dk-sync__status is-error' : 'dk-sync__status'}>
          {state.error ?? state.status}
        </span>
      </div>

      {state.plan && state.plan.changes.length > 0 && (
        <PlanList plan={state.plan} />
      )}
    </>
  );
}

function PlanList({ plan }: { plan: SyncPlan }) {
  return (
    <div className="dr-plan">
      {plan.changes.map((action, i) => (
        <div className="dr-plan__row" key={`${action.type}-${action.path}-${i}`}>
          <span className={`dr-plan__tag ${action.type}`}>{label(action.type)}</span>
          <span>{describe(action)}</span>
        </div>
      ))}
    </div>
  );
}

function label(type: string): string {
  switch (type) {
    case 'upload':
      return 'на сервер';
    case 'download':
      return 'з сервера';
    case 'delete-remote':
      return 'видалити там';
    case 'delete-local':
      return 'видалити тут';
    case 'conflict':
      return 'конфлікт';
    default:
      return type;
  }
}

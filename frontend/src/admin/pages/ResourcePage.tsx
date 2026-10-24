import { useCallback } from 'react';
import { useAuthSession } from '../../app/AuthSessionProvider';
import { autoColumns, type ResourceConfig } from '../resources';
import { DataTable, type Row } from '../components/DataTable';
import { useApiList } from '../hooks/useApiList';

export function ResourcePage({ config }: { config: ResourceConfig }) {
  const { request } = useAuthSession();
  const load = useCallback(() => config.load(request), [config, request]);
  const { state, items, error, reload } = useApiList<Row>(load, [load]);
  return <DataTable<Row> rows={items} state={state} error={error} onReload={reload} columns={config.columns ?? autoColumns(items)} detailTitle={config.detailTitle} />;
}

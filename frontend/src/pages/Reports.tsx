import { useEffect, useMemo, useState } from 'react';
import { Header } from '../components/layout';
import { api } from '../services/api';
import { Download, Eye, Filter, Save, Trash2 } from 'lucide-react';

type ReportColumn = {
  column_name: string;
  data_type: string;
  operators: string[];
};

type ReportFilter = {
  id: string;
  column: string;
  operator: string;
  value: string;
};

function buildFilters(filters: ReportFilter[]) {
  return filters
    .filter((f) => f.column && f.operator)
    .map((f) => {
      if (f.operator === 'in') {
        return {
          column: f.column,
          operator: 'in',
          value: f.value.split(',').map((v) => v.trim()).filter(Boolean),
        };
      }
      if (f.operator === 'between') {
        const [a, b] = f.value.split(',').map((v) => v.trim());
        return { column: f.column, operator: 'between', value: [a, b] };
      }
      return { column: f.column, operator: f.operator, value: f.value };
    });
}

export function Reports() {
  const [modules, setModules] = useState<any[]>([]);
  const [moduleKey, setModuleKey] = useState('');
  const [columns, setColumns] = useState<ReportColumn[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [saveName, setSaveName] = useState('');
  const [savePublic, setSavePublic] = useState(false);
  const [modulesError, setModulesError] = useState('');
  const [schemaError, setSchemaError] = useState('');
  const [definitionsError, setDefinitionsError] = useState('');

  const selectedModule = useMemo(
    () => modules.find((m) => m.key === moduleKey),
    [modules, moduleKey]
  );

  const reportPayload = useMemo(
    () => ({
      module: moduleKey,
      columns: selectedColumns,
      filters: buildFilters(filters),
      sort: selectedColumns.length ? { column: selectedColumns[0], direction: 'asc' } : null,
      page: 1,
      pageSize: 50,
    }),
    [moduleKey, selectedColumns, filters]
  );

  const fetchDefinitions = async () => {
    try {
      setDefinitionsError('');
      const defs = await api.getReportDefinitions();
      setDefinitions(defs);
    } catch (err) {
      console.error('Failed to fetch report definitions:', err);
      setDefinitionsError('Failed to load saved reports.');
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        setModulesError('');
        const list = await api.getReportModules();
        setModules(list);
        if (list.length) {
          setModuleKey(list[0].key);
        } else {
          setModulesError('No reportable modules available for your role.');
        }
      } catch (err) {
        console.error('Failed to fetch report modules:', err);
        setModulesError('Failed to load report modules. Please refresh or contact admin.');
      }
      await fetchDefinitions();
    };
    init();
  }, []);

  useEffect(() => {
    const fetchSchema = async () => {
      if (!moduleKey) return;
      try {
        setSchemaError('');
        const schema = await api.getReportModuleSchema(moduleKey);
        setColumns(schema.columns || []);
        setSelectedColumns((schema.columns || []).slice(0, 5).map((c: any) => c.column_name));
        if (!schema.columns?.length) {
          setSchemaError('No columns available for selected module.');
        }
        setFilters([]);
        setPreviewRows([]);
        setTotal(0);
      } catch (err) {
        console.error('Failed to fetch module schema:', err);
        setSchemaError('Failed to load module schema.');
        setColumns([]);
        setSelectedColumns([]);
      }
    };
    fetchSchema();
  }, [moduleKey]);

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const addFilter = () => {
    setFilters((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        column: columns[0]?.column_name || '',
        operator: columns[0]?.operators?.[0] || 'eq',
        value: '',
      },
    ]);
  };

  const runPreview = async () => {
    if (!moduleKey || !selectedColumns.length) return;
    setLoading(true);
    try {
      const result = await api.previewReport(reportPayload);
      setPreviewRows(result.rows || []);
      setTotal(result.total || 0);
    } catch (err: any) {
      alert(err.message || 'Failed to preview report');
    } finally {
      setLoading(false);
    }
  };

  const download = async (format: 'csv' | 'xlsx') => {
    if (!moduleKey || !selectedColumns.length) return;
    try {
      const blob = await api.downloadReport({ ...reportPayload, format });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${moduleKey}-report.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || `Failed to download ${format.toUpperCase()} report`);
    }
  };

  const saveDefinition = async () => {
    if (!saveName.trim()) return alert('Enter report name');
    if (!moduleKey || !selectedColumns.length) return alert('Select module and columns first');
    try {
      await api.createReportDefinition({
        name: saveName.trim(),
        module_key: moduleKey,
        config_json: reportPayload,
        is_public: savePublic,
      });
      setSaveName('');
      setSavePublic(false);
      await fetchDefinitions();
      alert('Report definition saved');
    } catch (err: any) {
      alert(err.message || 'Failed to save report definition');
    }
  };

  const loadDefinition = (def: any) => {
    const cfg = typeof def.config_json === 'string' ? JSON.parse(def.config_json) : def.config_json;
    setModuleKey(def.module_key);
    setTimeout(() => {
      setSelectedColumns(cfg.columns || []);
      setFilters(
        (cfg.filters || []).map((f: any) => ({
          id: crypto.randomUUID(),
          column: f.column,
          operator: f.operator,
          value: Array.isArray(f.value) ? f.value.join(', ') : String(f.value ?? ''),
        }))
      );
    }, 0);
  };

  const removeDefinition = async (id: string) => {
    if (!confirm('Delete this saved report?')) return;
    try {
      await api.deleteReportDefinition(id);
      await fetchDefinitions();
    } catch (err: any) {
      alert(err.message || 'Failed to delete report definition');
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="Reports" subtitle="Dynamic report builder across all modules" />
      <div className="p-6 space-y-6">
        {modulesError && (
          <div className="card p-3 border border-danger-200 bg-danger-50 text-danger-700 text-sm">
            {modulesError}
          </div>
        )}
        {schemaError && (
          <div className="card p-3 border border-warning-200 bg-warning-50 text-warning-700 text-sm">
            {schemaError}
          </div>
        )}
        {definitionsError && (
          <div className="card p-3 border border-warning-200 bg-warning-50 text-warning-700 text-sm">
            {definitionsError}
          </div>
        )}
        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Module</label>
              <select className="input" value={moduleKey} onChange={(e) => setModuleKey(e.target.value)}>
                {modules.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Selected Columns</label>
              <p className="text-sm text-neutral-600 pt-2">{selectedColumns.length} selected</p>
            </div>
            <div className="flex items-end gap-2">
              <button onClick={runPreview} className="btn-primary flex-1" disabled={loading || !moduleKey || !selectedColumns.length}>
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button onClick={() => download('csv')} className="btn-secondary" disabled={!selectedColumns.length}>
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button onClick={() => download('xlsx')} className="btn-secondary" disabled={!selectedColumns.length}>
                <Download className="w-4 h-4" />
                XLSX
              </button>
            </div>
          </div>

          <div>
            <label className="label">Columns</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto border rounded-lg p-3">
              {columns.map((c) => (
                <label key={c.column_name} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selectedColumns.includes(c.column_name)} onChange={() => toggleColumn(c.column_name)} />
                  <span className="font-mono">{c.column_name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="label mb-0">Filters</label>
              <button onClick={addFilter} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <Filter className="w-4 h-4" />
                Add Filter
              </button>
            </div>
            {filters.map((f) => {
              const colMeta = columns.find((c) => c.column_name === f.column);
              const ops = colMeta?.operators || ['eq'];
              return (
                <div key={f.id} className="grid grid-cols-12 gap-2">
                  <select
                    className="input col-span-4"
                    value={f.column}
                    onChange={(e) =>
                      setFilters((prev) =>
                        prev.map((x) => (x.id === f.id ? { ...x, column: e.target.value } : x))
                      )
                    }
                  >
                    {columns.map((c) => (
                      <option key={c.column_name} value={c.column_name}>
                        {c.column_name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input col-span-3"
                    value={f.operator}
                    onChange={(e) =>
                      setFilters((prev) =>
                        prev.map((x) => (x.id === f.id ? { ...x, operator: e.target.value } : x))
                      )
                    }
                  >
                    {ops.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input col-span-4"
                    value={f.value}
                    onChange={(e) =>
                      setFilters((prev) =>
                        prev.map((x) => (x.id === f.id ? { ...x, value: e.target.value } : x))
                      )
                    }
                    placeholder={f.operator === 'between' ? 'value1, value2' : f.operator === 'in' ? 'v1, v2, v3' : 'value'}
                  />
                  <button
                    className="col-span-1 p-2 text-danger-600 hover:bg-danger-50 rounded"
                    onClick={() => setFilters((prev) => prev.filter((x) => x.id !== f.id))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Saved Reports</h3>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Report name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={savePublic} onChange={(e) => setSavePublic(e.target.checked)} />
                Public
              </label>
              <button className="btn-primary" onClick={saveDefinition}>
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {definitions.length === 0 && <p className="text-sm text-neutral-500">No saved reports yet.</p>}
            {definitions.map((d) => (
              <div key={d.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-neutral-500">{d.module_key} {d.is_public ? '• public' : '• private'}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary" onClick={() => loadDefinition(d)}>
                    Load
                  </button>
                  <button className="btn-secondary text-danger-600" onClick={() => removeDefinition(d.id)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Preview</h3>
            <span className="text-sm text-neutral-500">{total} rows</span>
          </div>
          <div className="overflow-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  {selectedColumns.map((c) => (
                    <th key={c} className="text-left px-3 py-2 font-medium text-neutral-600 whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-neutral-500" colSpan={Math.max(1, selectedColumns.length)}>
                      No preview data. Select module/columns and click Preview.
                    </td>
                  </tr>
                ) : (
                  previewRows.map((row, idx) => (
                    <tr key={idx} className="border-t">
                      {selectedColumns.map((c) => (
                        <td key={c} className="px-3 py-2 whitespace-nowrap">
                          {row[c] == null ? '' : String(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {selectedModule && (
            <p className="text-xs text-neutral-500 mt-2">
              Module: <span className="font-medium">{selectedModule.label}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

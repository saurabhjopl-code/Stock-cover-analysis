import React, { useState, useMemo } from "react";

export default function DataTable({ columns = [], rows = [], pageSize = 25, defaultSort = null }) {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState(defaultSort?.key || null);
  const [desc, setDesc] = useState(defaultSort?.desc ?? false);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const out = [...rows].sort((a, b) => {
      const va = parseFloatVal(a[sortKey]);
      const vb = parseFloatVal(b[sortKey]);
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return desc ? (vb - va) : (va - vb);
    });
    return out;
  }, [rows, sortKey, desc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageData = sorted.slice((page - 1) * pageSize, page * pageSize);

  function toggleSort(k) {
    if (sortKey === k) {
      setDesc(!desc);
    } else {
      setSortKey(k);
      setDesc(false);
    }
    setPage(1);
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="p-2 text-left">
                  <button onClick={() => toggleSort(c.key)} className="flex items-center gap-2">
                    <span>{c.label}</span>
                    {sortKey === c.key && <span className="text-xs text-gray-500">{desc ? "↓" : "↑"}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((r, idx) => (
              <tr key={idx} className="border-t">
                {columns.map((c) => (
                  <td key={c.key} className="p-2 align-top">
                    {formatCell(r[c.key])}
                  </td>
                ))}
              </tr>
            ))}
            {pageData.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-4 text-center text-gray-500">No rows</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, sorted.length)} of {sorted.length}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 border rounded text-sm">First</button>
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-2 py-1 border rounded text-sm">Prev</button>
          <span className="px-2 text-sm">Page {page}/{totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-2 py-1 border rounded text-sm">Next</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 border rounded text-sm">Last</button>
        </div>
      </div>
    </div>
  );
}

function parseFloatVal(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[^0-9.\-eE]/g, ""));
  return isNaN(n) ? null : n;
}

function formatCell(v) {
  if (v === null || v === undefined) return "-";
  const n = parseFloatVal(v);
  if (n !== null) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(v);
}

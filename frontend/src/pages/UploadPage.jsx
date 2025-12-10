import React, { useState } from "react";
import { processFiles, getDownloadUrl } from "../api/api";
import { useNavigate } from "react-router-dom";

export default function UploadPage() {
  const [salesFile, setSalesFile] = useState(null);
  const [stockFile, setStockFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  function onSelectFile(e, setter) {
    setError(null);
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const ext = f.name.split(".").pop().toLowerCase();
    if (ext !== "csv") {
      setter(null);
      setError("Please upload a CSV file.");
      return;
    }
    setter(f);
  }

  async function handleProcess() {
    setError(null);
    setResult(null);

    if (!salesFile || !stockFile) {
      setError("Both Sales CSV and FBF Stock CSV are required.");
      return;
    }

    try {
      setProcessing(true);
      setProgress(5);

      const resp = await processFiles(salesFile, stockFile, (p) => setProgress(p));
      setProgress(100);

      if (resp && resp.status === "success") {
        setResult(resp);
        setError(null);
        navigate("/dashboard", { state: { result: resp } });
      } else {
        setError((resp && resp.error) || "Processing failed");
      }
    } catch (err) {
      console.error(err);
      setError(err?.error || "Unexpected error while processing files.");
    } finally {
      setProcessing(false);
      setTimeout(() => setProgress(0), 800);
    }
  }

  function renderDownloadLinks() {
    const files = [
      { key: "stock_cover_summary.csv", label: "Stock Cover Summary (CSV)" },
      { key: "warehouse_level_stock.csv", label: "Warehouse Level (CSV)" },
      { key: "refill_recommendations.csv", label: "Refill Recommendations (CSV)" },
      { key: "excess_stock.csv", label: "Excess Stock (>60d) (CSV)" },
    ];
    return (
      <div className="space-y-2 mt-4">
        <h3 className="text-lg font-medium">Download Reports</h3>
        <div className="flex flex-wrap gap-2">
          {files.map((f) => (
            <a
              key={f.key}
              href={getDownloadUrl(f.key)}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              target="_blank"
              rel="noreferrer"
            >
              {f.label}
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Flipkart FBF Analyzer — Upload CSVs</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded p-4">
          <label className="block text-sm font-medium mb-2">Flipkart Sales CSV</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => onSelectFile(e, setSalesFile)}
            className="block w-full text-sm text-gray-700"
            disabled={processing}
          />
          {salesFile && <p className="mt-2 text-sm text-gray-600">Selected: {salesFile.name} — {(salesFile.size/1024).toFixed(1)} KB</p>}
        </div>

        <div className="border rounded p-4">
          <label className="block text-sm font-medium mb-2">FBF Stock CSV</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => onSelectFile(e, setStockFile)}
            className="block w-full text-sm text-gray-700"
            disabled={processing}
          />
          {stockFile && <p className="mt-2 text-sm text-gray-600">Selected: {stockFile.name} — {(stockFile.size/1024).toFixed(1)} KB</p>}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleProcess}
          disabled={processing}
          className={`px-5 py-2 rounded text-white ${processing ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"}`}
        >
          {processing ? "Processing..." : "Process Files"}
        </button>

        <button
          onClick={() => { setSalesFile(null); setStockFile(null); setResult(null); setError(null); }}
          className="px-4 py-2 border rounded text-sm"
          disabled={processing}
        >
          Reset
        </button>

        {processing && (
          <div className="ml-4 text-sm text-gray-600">
            Progress: {progress}%
            <div className="w-48 bg-gray-200 rounded mt-1">
              <div className="h-2 bg-indigo-500 rounded" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {result && (
        <>
          <div className="mt-6 bg-white border rounded p-4">
            <h3 className="text-lg font-medium mb-2">Quick Preview (top 10 SKUs)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">SKU</th>
                    <th className="p-2">Total Sales</th>
                    <th className="p-2">DRR</th>
                    <th className="p-2">30d Req</th>
                    <th className="p-2">Total FBF Stock</th>
                    <th className="p-2">Stock Cover Days</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(result.summary) && result.summary.slice(0, 10).map((r, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{r.SKU ?? r.sku}</td>
                      <td className="p-2">{r["Total Sales"] ?? r.total_sales ?? r.TotalSales}</td>
                      <td className="p-2">{formatNumber(r.DRR ?? r.drr)}</td>
                      <td className="p-2">{formatNumber(r["30day_requirement"] ?? r._30day_requirement ?? r["30dayRequirement"])}</td>
                      <td className="p-2">{r["Total FBF Stock"] ?? r.total_fbf_stock ?? r.TotalFBFStock}</td>
                      <td className="p-2">{formatNumber(r["Stock Cover Days (SKU level)"] ?? r.stock_cover_days_sku ?? r.stock_cover_days)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {renderDownloadLinks()}
          </div>
        </>
      )}
    </div>
  );
}

function formatNumber(v) {
  if (v === null || v === undefined) return "-";
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(2) : "∞";
  const n = Number(v);
  if (!isNaN(n)) return Number.isFinite(n) ? n.toFixed(2) : "∞";
  return v;
}

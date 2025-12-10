// frontend/src/pages/Dashboard.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SummaryCards from "../components/SummaryCards";
import DataTable from "../components/DataTable";
import { getDownloadUrl } from "../api/api";

/*
 Dashboard behaviour:
  - Try to read processed data from location.state.result (set by UploadPage)
  - If missing, fetch CSV files from backend download endpoints and parse them
  - Show summary cards + three main tabs:
      1. Stock Cover Summary (SKU level)
      2. Warehouse Level
      3. Refill Recommendations & Excess Stock (two small tables)
*/

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const initialResult = location?.state?.result ?? null;

  const [loading, setLoading] = useState(!initialResult);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(initialResult);
  const [activeTab, setActiveTab] = useState("summary"); // summary | warehouse | refill | excess
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (result) {
      setLoading(false);
      return;
    }
    // If no result passed from UploadPage, fetch CSVs from backend
    async function fetchFromBackend() {
      try {
        setLoading(true);
        const files = {
          summary: getDownloadUrl("stock_cover_summary.csv"),
          warehouse: getDownloadUrl("warehouse_level_stock.csv"),
          refill: getDownloadUrl("refill_recommendations.csv"),
          excess: getDownloadUrl("excess_stock.csv"),
        };

        const fetchCSV = async (url) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to fetch ${url}`);
          const text = await res.text();
          return parseCSV(text);
        };

        const [summary, warehouse, refill, excess] = await Promise.all([
          fetchCSV(files.summary),
          fetchCSV(files.warehouse),
          fetchCSV(files.refill),
          fetchCSV(files.excess),
        ]);

        const assembled = {
          status: "success",
          summary,
          warehouse,
          refill,
          excess,
        };
        setResult(assembled);
        setError(null);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to fetch reports from backend.");
      } finally {
        setLoading(false);
      }
    }

    fetchFromBackend();
  }, [initialResult]);

  // Basic CSV parser (no dependencies) -> array of objects
  function parseCSV(text) {
    // split lines, handle simple quoted values
    const rows = text.trim().split(/\r?\n/);
    if (!rows.length) return [];
    // header
    const headers = rows[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const line = rows[i];
      // simple split - will break on embedded commas in quotes, but works for typical CSVs
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const obj = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = cols[j] === undefined ? "" : cols[j];
      }
      data.push(obj);
    }
    return data;
  }

  const summaryRows = useMemo(() => (result?.summary ?? []), [result]);
  const warehouseRows = useMemo(() => (result?.warehouse ?? []), [result]);
  const refillRows = useMemo(() => (result?.refill ?? []), [result]);
  const excessRows = useMemo(() => (result?.excess ?? []), [result]);

  // Filtering by SKU search
  const filteredSummary = summaryRows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.SKU && String(r.SKU).toLowerCase().includes(s)) ||
           (r.sku && String(r.sku).toLowerCase().includes(s));
  });

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-gray-600">Loading processed data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 p-4 rounded text-red-700">
          {error}
        </div>
        <div className="mt-4">
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-indigo-600 text-white rounded"
          >
            Go back to Upload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">FBF Analyzer — Dashboard</h1>
        <div className="space-x-2">
          <button onClick={() => navigate("/")} className="px-3 py-1 border rounded">Upload new files</button>
          <a
            className="px-3 py-1 bg-indigo-600 text-white rounded"
            href={getDownloadUrl("stock_cover_summary.csv")}
            target="_blank"
            rel="noreferrer"
          >
            Download Summary CSV
          </a>
        </div>
      </div>

      <div className="mt-4">
        <SummaryCards
          summaryCount={summaryRows.length}
          warehouseCount={warehouseRows.length}
          refillCount={refillRows.length}
          excessCount={excessRows.length}
        />
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-3">
          <div className="flex space-x-2 bg-gray-50 p-1 rounded">
            <Tab name="summary" label="Stock Cover (SKU)" activeTab={activeTab} setActiveTab={setActiveTab} />
            <Tab name="warehouse" label="Warehouse Level" activeTab={activeTab} setActiveTab={setActiveTab} />
            <Tab name="refill" label="Refill Recommendations" activeTab={activeTab} setActiveTab={setActiveTab} />
            <Tab name="excess" label="Excess (>60d)" activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <input
              placeholder="Search SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1 border rounded text-sm"
            />
          </div>
        </div>

        <div className="mt-4 bg-white border rounded p-4">
          {activeTab === "summary" && (
            <DataTable
              columns={[
                { key: "SKU", label: "SKU" },
                { key: "Total Sales", label: "Total Sales" },
                { key: "DRR", label: "DRR" },
                { key: "30day_requirement", label: "30d Req" },
                { key: "Total FBF Stock", label: "Total FBF Stock" },
                { key: "Stock Cover Days (SKU level)", label: "Stock Cover Days" },
              ]}
              rows={filteredSummary}
              defaultSort={{ key: "Total Sales", desc: true }}
            />
          )}

          {activeTab === "warehouse" && (
            <DataTable
              columns={[
                { key: "SKU", label: "SKU" },
                { key: "Warehouse Id", label: "Warehouse Id" },
                { key: "Live on Website", label: "FBF Stock" },
                { key: "DRR", label: "DRR" },
                { key: "Stock Cover Days (Warehouse)", label: "Stock Cover Days" },
              ]}
              rows={warehouseRows}
              defaultSort={{ key: "Live on Website", desc: true }}
            />
          )}

          {activeTab === "refill" && (
            <>
              <h3 className="mb-2 font-medium">Refill Recommendations</h3>
              <DataTable
                columns={[
                  { key: "SKU", label: "SKU" },
                  { key: "Total Sales", label: "Total Sales" },
                  { key: "DRR", label: "DRR" },
                  { key: "30day_requirement", label: "30d Req" },
                  { key: "Total FBF Stock", label: "Total FBF Stock" },
                  { key: "Required Qty to reach 30d", label: "Required Qty" },
                  { key: "Recommended Warehouse", label: "Recommended Warehouse" },
                ]}
                rows={refillRows}
                defaultSort={{ key: "Required Qty to reach 30d", desc: true }}
              />
            </>
          )}

          {activeTab === "excess" && (
            <>
              <h3 className="mb-2 font-medium">Excess Stock (per Warehouse)</h3>
              <DataTable
                columns={[
                  { key: "SKU", label: "SKU" },
                  { key: "Warehouse Id", label: "Warehouse" },
                  { key: "Live on Website", label: "FBF Stock" },
                  { key: "DRR", label: "DRR" },
                  { key: "Stock Cover Days (Warehouse)", label: "Stock Cover Days" },
                  { key: "Excess Qty (if >60 days)", label: "Excess Qty" },
                ]}
                rows={excessRows}
                defaultSort={{ key: "Excess Qty (if >60 days)", desc: true }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* tiny helpers */
function Tab({ name, label, activeTab, setActiveTab }) {
  const active = activeTab === name;
  return (
    <button
      className={`px-3 py-1 rounded ${active ? "bg-white shadow" : "bg-transparent text-gray-600"}`}
      onClick={() => setActiveTab(name)}
    >
      {label}
    </button>
  );
}

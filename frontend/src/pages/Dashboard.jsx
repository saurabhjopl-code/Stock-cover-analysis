import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SummaryCards from "../components/SummaryCards";
import DataTable from "../components/DataTable";
import { getDownloadUrl } from "../api/api";
import Papa from "papaparse";
import TopRefillChart from "../components/TopRefillChart";

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const initialResult = location?.state?.result ?? null;

  const [loading, setLoading] = useState(!initialResult);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(initialResult);
  const [activeTab, setActiveTab] = useState("summary");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (result) {
      setLoading(false);
      return;
    }
    async function fetchFromBackend() {
      try {
        setLoading(true);
        const files = {
          summary: getDownloadUrl("stock_cover_summary.csv"),
          warehouse: getDownloadUrl("warehouse_level_stock.csv"),
          refill: getDownloadUrl("refill_recommendations.csv"),
          excess: getDownloadUrl("excess_stock.csv"),
        };

        const fetchAndParse = async (url) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to fetch ${url}`);
          const text = await res.text();
          return new Promise((resolve, reject) => {
            Papa.parse(text, {
              header: true,
              skipEmptyLines: true,
              complete: (p) => resolve(p.data),
              error: (err) => reject(err),
            });
          });
        };

        const [summary, warehouse, refill, excess] = await Promise.all([
          fetchAndParse(files.summary),
          fetchAndParse(files.warehouse),
          fetchAndParse(files.refill),
          fetchAndParse(files.excess),
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

  const summaryRows = useMemo(() => (result?.summary ?? []), [result]);
  const warehouseRows = useMemo(() => (result?.warehouse ?? []), [result]);
  const refillRows = useMemo(() => (result?.refill ?? []), [result]);
  const excessRows = useMemo(() => (result?.excess ?? []), [result]);

  const filteredSummary = summaryRows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.SKU && String(r.SKU).toLowerCase().includes(s)) ||
           (r.sku && String(r.sku).toLowerCase().includes(s));
  });

  const topRefillData = useMemo(() => {
    if (!refillRows || !Array.isArray(refillRows) || refillRows.length === 0) return [];
    const qtyKeys = ["Required Qty to reach 30d", "Required Qty", "RequiredQty", "required_qty"];
    const skuKeys = ["SKU", "sku", "Sku"];
    const qtyKey = qtyKeys.find((k) => refillRows[0] && Object.prototype.hasOwnProperty.call(refillRows[0], k));
    const skuKey = skuKeys.find((k) => refillRows[0] && Object.prototype.hasOwnProperty.call(refillRows[0], k));
    if (!qtyKey || !skuKey) return [];

    const parsed = refillRows.map(r => {
      const qty = Number(String(r[qtyKey] || "0").replace(/[^0-9.\-eE]/g, "")) || 0;
      return { sku: r[skuKey], qty };
    }).sort((a,b) => b.qty - a.qty).slice(0, 10);

    return parsed;
  }, [refillRows]);

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

              <div className="mb-6">
                <TopRefillChart data={topRefillData} />
              </div>

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

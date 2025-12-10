import React from "react";

export default function SummaryCards({ summaryCount = 0, warehouseCount = 0, refillCount = 0, excessCount = 0 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card title="SKUs (summary)" value={summaryCount} />
      <Card title="Warehouse rows" value={warehouseCount} />
      <Card title="SKUs needing refill" value={refillCount} highlight />
      <Card title="Excess entries (>60d)" value={excessCount} />
    </div>
  );
}

function Card({ title, value, highlight }) {
  return (
    <div className={`p-4 border rounded ${highlight ? "bg-yellow-50" : "bg-white"}`}>
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

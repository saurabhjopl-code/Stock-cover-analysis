import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export default function TopRefillChart({ data = [] }) {
  if (!data || data.length === 0) {
    return <div className="p-4 text-sm text-gray-600">No refill data to display.</div>;
  }

  const chartData = data.map(d => ({ sku: String(d.sku), qty: Number(d.qty) }));

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} layout="vertical" margin={{ top: 20, right: 40, left: 80, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="sku" width={150} />
          <Tooltip formatter={(val) => val.toLocaleString()} />
          <Legend />
          <Bar dataKey="qty" name="Required Qty (30d)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

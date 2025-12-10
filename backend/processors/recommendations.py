# backend/processors/recommendations.py
import pandas as pd
import numpy as np

def get_recommendations(summary_df: pd.DataFrame, warehouse_df: pd.DataFrame):
    """
    Inputs:
      - summary_df: SKU-level summary that includes at least SKU, Total Sales, DRR, 30day_requirement, Total FBF Stock
      - warehouse_df: SKU+Warehouse level DF that includes SKU, Warehouse Id, Live on Website, DRR, Stock Cover Days (Warehouse)

    Returns:
      - refill_df: DataFrame of SKUs needing refill with Required Qty to reach 30d and Recommended Warehouse
      - excess_df: DataFrame of warehouse entries with >60 days of cover, and computed excess qty
    """

    summary = summary_df.copy()
    warehouse = warehouse_df.copy()

    # Ensure expected columns exist
    for col in ["SKU", "30day_requirement", "Total FBF Stock", "DRR"]:
        if col not in summary.columns:
            # try lowercase variants
            if col.lower() in summary.columns:
                summary = summary.rename(columns={col.lower(): col})
            else:
                # if missing 30day_requirement, compute if possible
                if col == "30day_requirement" and "DRR" in summary.columns:
                    summary["30day_requirement"] = summary["DRR"] * 30
                else:
                    # continue; some columns may be missing for corner cases
                    pass

    # Refill: Total FBF Stock < 30day_requirement
    summary["Total FBF Stock"] = pd.to_numeric(summary["Total FBF Stock"], errors="coerce").fillna(0.0)
    summary["30day_requirement"] = pd.to_numeric(summary["30day_requirement"], errors="coerce").fillna(0.0)

    summary["Needs Refill (30d)"] = summary["Total FBF Stock"] < summary["30day_requirement"]
    summary["Required Qty to reach 30d"] = (summary["30day_requirement"] - summary["Total FBF Stock"]).clip(lower=0).round(0)

    # Build helper tables for recommendation selection
    # 1) prefer warehouse with highest historical FBF sales (if present in warehouse_df or a sales-FBF mapping)
    # We will attempt to use warehouse_df combined with a column 'Total Sales' if available.
    # If not present, fall back to warehouse with max stock.

    # For fallback we compute the warehouse with max existing stock per SKU
    max_stock_wh = warehouse.groupby("SKU").apply(lambda g: g.sort_values("Live on Website", ascending=False).head(1)).reset_index(drop=True)
    max_stock_wh = max_stock_wh[["SKU", "Warehouse Id", "Live on Website"]].rename(columns={"Warehouse Id": "MaxStockWarehouse", "Live on Website": "MaxStockQty"})

    # If warehouse_df contains 'Total Sales' per SKU+Warehouse (from sales FBF split) prefer that
    recs = summary.merge(max_stock_wh, on="SKU", how="left")

    # Build recommended warehouse: If warehouse entries contain same Warehouse Id as top FBF sales location, pick it.
    # But since we don't have FBF-sales-per-warehouse passed here, we'll choose MaxStockWarehouse as recommended.
    recs["Recommended Warehouse"] = recs["MaxStockWarehouse"]

    refill_df = recs[recs["Needs Refill (30d)"].fillna(False)].copy() if "Needs Refill (30d)" in recs.columns else recs[recs["Total FBF Stock"] < recs["30day_requirement"]].copy()

    # select useful columns
    keep_cols = ["SKU", "Total Sales", "DRR", "30day_requirement", "Total FBF Stock", "Required Qty to reach 30d", "Recommended Warehouse"]
    existing = [c for c in keep_cols if c in refill_df.columns]
    refill_df = refill_df[existing].copy()

    # Excess: warehouse rows where Stock Cover Days (Warehouse) > 60
    # Ensure numeric values
    if "Stock Cover Days (Warehouse)" in warehouse.columns:
        warehouse["Stock Cover Days (Warehouse)"] = pd.to_numeric(warehouse["Stock Cover Days (Warehouse)"], errors="coerce").fillna(np.inf)

    def compute_excess(row):
        # ExcessQty = Live on Website - DRR * 60 if cover > 60 and DRR > 0
        dr = row.get("DRR", 0)
        live = row.get("Live on Website", 0)
        cover = row.get("Stock Cover Days (Warehouse)", np.inf)
        if dr and cover > 60:
            excess_qty = live - (dr * 60)
            return max(0, excess_qty)
        return 0

    # Merge DRR into warehouse rows (if not present)
    if "DRR" not in warehouse.columns:
        # try to merge DRR from summary
        if "SKU" in summary.columns:
            warehouse = warehouse.merge(summary[["SKU", "DRR"]], on="SKU", how="left", suffixes=("", "_from_summary"))

    warehouse["Excess Qty (if >60 days)" ] = warehouse.apply(compute_excess, axis=1)
    excess_df = warehouse[warehouse["Excess Qty (if >60 days)" ] > 0].copy()

    excess_keep = ["SKU", "Warehouse Id", "Live on Website", "DRR", "Stock Cover Days (Warehouse)", "Excess Qty (if >60 days)"]
    existing_excess_cols = [c for c in excess_keep if c in excess_df.columns]
    excess_df = excess_df[existing_excess_cols].copy()

    return refill_df.reset_index(drop=True), excess_df.reset_index(drop=True)

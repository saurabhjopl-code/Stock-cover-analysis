# backend/processors/stock_cover.py
import pandas as pd
import numpy as np

from .drr import _find_column  # reuse helper (internal)

def compute_stock_cover(drr_df: pd.DataFrame, stock_df: pd.DataFrame):
    """
    Inputs:
      - drr_df: DataFrame returned by calculate_drr (must have SKU, DRR, 30day_requirement, Total Sales)
      - stock_df: raw stock dataframe with SKU, Warehouse Id, Live on Website (or similar)
    Returns:
      - summary_df: SKU-level DataFrame with Total FBF Stock and Stock Cover Days (SKU level)
      - warehouse_df: SKU+Warehouse-level DataFrame with Live on Website and Stock Cover Days (Warehouse)
    """

    stock = stock_df.copy()
    stock.columns = [c.strip() for c in stock.columns]

    sku_col = _find_column(stock, ["SKU", "SKU ID", "product_sku", "productsku"])
    warehouse_col = _find_column(stock, ["Warehouse Id", "WarehouseId", "Warehouse", "Location Id", "LocationId", "FC Id"])
    live_col = _find_column(stock, ["Live on Website", "LiveOnWebsite", "Live", "Available", "AvailableQty", "Stock", "Qty"])

    if sku_col is None:
        sku_col = stock.columns[0]
    if warehouse_col is None and len(stock.columns) > 1:
        warehouse_col = stock.columns[1]
    if live_col is None:
        # fallback to last column
        live_col = stock.columns[-1]

    # rename
    stock = stock.rename(columns={sku_col: "SKU", warehouse_col: "Warehouse Id", live_col: "Live on Website"})
    stock["Live on Website"] = pd.to_numeric(stock["Live on Website"], errors="coerce").fillna(0.0)

    # aggregate per SKU + Warehouse
    stock_grouped = stock.groupby(["SKU", "Warehouse Id"], dropna=False)["Live on Website"].sum().reset_index()

    # total FBF stock per SKU
    total_stock = stock_grouped.groupby("SKU", dropna=False)["Live on Website"].sum().reset_index().rename(columns={"Live on Website": "Total FBF Stock"})

    # merge with drr_df
    # ensure drr_df has a column named 'SKU'
    drr = drr_df.copy()
    if "SKU" not in drr.columns:
        # try lowercases
        if "sku" in drr.columns:
            drr = drr.rename(columns={"sku":"SKU"})
        else:
            raise ValueError("drr_df must contain SKU column")

    summary = drr.merge(total_stock, on="SKU", how="left")
    summary["Total FBF Stock"] = summary["Total FBF Stock"].fillna(0.0)

    # Stock cover days at SKU level
    def sku_cover_days(row):
        drr_val = row.get("DRR", 0)
        if drr_val == 0:
            return float("inf")
        return row["Total FBF Stock"] / drr_val

    summary["Stock Cover Days (SKU level)"] = summary.apply(sku_cover_days, axis=1)

    # Warehouse-level merging
    warehouse = stock_grouped.merge(drr[["SKU", "DRR", "30day_requirement", "Total Sales"]], on="SKU", how="left")
    warehouse["DRR"] = warehouse["DRR"].fillna(0.0)

    def warehouse_cover_days(row):
        drr_val = row.get("DRR", 0)
        if drr_val == 0:
            return float("inf")
        return row["Live on Website"] / drr_val

    warehouse["Stock Cover Days (Warehouse)"] = warehouse.apply(warehouse_cover_days, axis=1)

    # Ensure numeric
    warehouse["Live on Website"] = warehouse["Live on Website"].astype(float)
    warehouse["Stock Cover Days (Warehouse)"] = warehouse["Stock Cover Days (Warehouse)"].astype(float, errors="ignore")

    return summary, warehouse

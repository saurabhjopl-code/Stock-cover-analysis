# backend/processors/drr.py
import pandas as pd
import numpy as np

def _find_column(df, candidates):
    """Return first matching column name from candidates (case-insensitive, spaces ignored)."""
    cols = {c.lower().replace(" ", ""): c for c in df.columns}
    for cand in candidates:
        key = cand.lower().replace(" ", "")
        if key in cols:
            return cols[key]
    return None

def calculate_drr(sales_df: pd.DataFrame, default_days: int = 30) -> pd.DataFrame:
    """
    Calculate DRR and 30-day requirement per SKU.
    Returns DataFrame with columns:
      SKU, Total Sales, Days_in_period, DRR, 30day_requirement
    """
    df = sales_df.copy()
    # normalize column names (strip)
    df.columns = [c.strip() for c in df.columns]

    sku_col = _find_column(df, ["SKU", "SKU ID", "SkUId", "product_sku", "productsku"])
    if sku_col is None:
        # fallback to first column
        sku_col = df.columns[0]

    # sale qty candidates
    saleqty_col = _find_column(df, ["Sale Qty", "SaleQty", "Qty", "Quantity", "SoldQty", "OrderQty"])
    if saleqty_col is None:
        # assume each row = 1 sale if no column present
        df["Sale Qty"] = 1.0
        saleqty_col = "Sale Qty"
    else:
        df[saleqty_col] = pd.to_numeric(df[saleqty_col], errors="coerce").fillna(0)

    # order date if present
    date_col = _find_column(df, ["Order Date", "OrderDate", "Date", "order_date"])
    if date_col is not None:
        try:
            df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
            # count unique days WITH sales
            days_count = df.loc[df[date_col].notna(), date_col].dt.normalize().nunique()
            if days_count == 0:
                days_count = default_days
        except Exception:
            days_count = default_days
    else:
        days_count = default_days

    # group sales per SKU
    grouped = df.groupby(sku_col, dropna=False)[saleqty_col].sum().reset_index()
    grouped = grouped.rename(columns={sku_col: "SKU", saleqty_col: "Total Sales"})
    grouped["Days_in_period"] = int(days_count)
    grouped["DRR"] = grouped["Total Sales"] / grouped["Days_in_period"]
    grouped["30day_requirement"] = grouped["DRR"] * 30

    # ensure numeric types
    grouped["Total Sales"] = grouped["Total Sales"].astype(float)
    grouped["DRR"] = grouped["DRR"].astype(float)
    grouped["30day_requirement"] = grouped["30day_requirement"].astype(float)

    return grouped

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import pandas as pd
import numpy as np
import os
from processors.drr import calculate_drr
from processors.stock_cover import compute_stock_cover
from processors.recommendations import get_recommendations

app = FastAPI()

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = "outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)


@app.post("/process")
async def process_files(
    sales_file: UploadFile = File(...),
    stock_file: UploadFile = File(...)
):
    try:
        sales_df = pd.read_csv(sales_file.file)
        stock_df = pd.read_csv(stock_file.file)

        # 1️⃣ Compute DRR, 30-day requirement
        drr_df = calculate_drr(sales_df)

        # 2️⃣ Compute stock cover + SKU-level + warehouse-level
        summary_df, warehouse_df = compute_stock_cover(drr_df, stock_df)

        # 3️⃣ Refill + excess stock recommendations
        refill_df, excess_df = get_recommendations(summary_df, warehouse_df)

        # Save outputs
        summary_path = f"{OUTPUT_DIR}/stock_cover_summary.csv"
        warehouse_path = f"{OUTPUT_DIR}/warehouse_level_stock.csv"
        refill_path = f"{OUTPUT_DIR}/refill_recommendations.csv"
        excess_path = f"{OUTPUT_DIR}/excess_stock.csv"

        summary_df.to_csv(summary_path, index=False)
        warehouse_df.to_csv(warehouse_path, index=False)
        refill_df.to_csv(refill_path, index=False)
        excess_df.to_csv(excess_path, index=False)

        return {
            "status": "success",
            "summary": summary_df.to_dict(orient="records"),
            "warehouse": warehouse_df.to_dict(orient="records"),
            "refill": refill_df.to_dict(orient="records"),
            "excess": excess_df.to_dict(orient="records"),
        }

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/download/{file_name}")
async def download_file(file_name: str):
    file_path = f"{OUTPUT_DIR}/{file_name}"
    if os.path.exists(file_path):
        return FileResponse(file_path)
    return JSONResponse(status_code=404, content={"error": "File not found"})

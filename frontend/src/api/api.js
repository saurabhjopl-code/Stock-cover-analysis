const BACKEND_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

export async function processFiles(salesFile, stockFile, onProgress) {
  const formData = new FormData();
  formData.append("sales_file", salesFile);
  formData.append("stock_file", stockFile);

  const xhr = new XMLHttpRequest();
  return new Promise((resolve, reject) => {
    xhr.open("POST", `${BACKEND_BASE}/process`);
    xhr.responseType = "json";

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && typeof onProgress === "function") {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        reject(xhr.response || { error: `Status ${xhr.status}` });
      }
    };

    xhr.onerror = () => reject({ error: "Network error" });
    xhr.send(formData);
  });
}

export function getDownloadUrl(fileName) {
  return `${BACKEND_BASE}/download/${encodeURIComponent(fileName)}`;
}

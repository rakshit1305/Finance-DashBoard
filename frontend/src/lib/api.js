import axios from "axios";
const BACKEND_URL = "https://fullstack-app-production-e585.up.railway.app/";
export const API = `${BACKEND_URL}/api`;
const client = axios.create({ baseURL: API, timeout: 120000 });
export async function uploadDatasets(files) {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    const { data } = await client.post("/datasets/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
}
export async function fetchInsights(datasetId) {
    const { data } = await client.get(`/datasets/${datasetId}/insights`);
    return data.insights || [];
}
export async function askQuestion(datasetId, question) {
    const { data } = await client.post(`/datasets/${datasetId}/query`, { question });
    return data;
}
export async function fetchConfig() {
    const { data } = await client.get(`/config`);
    return data;
}
export function exportUrl(datasetId, fmt) {
    return `${API}/datasets/${datasetId}/export/${fmt}`;
}

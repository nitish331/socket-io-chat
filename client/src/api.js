import { SERVER_URL } from "./config";

export async function apiRequest(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${SERVER_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Is it running?");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

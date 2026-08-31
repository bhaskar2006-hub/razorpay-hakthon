import axios from "axios";

const rawUrl = (import.meta.env.VITE_API_URL || "https://razorpay-hakthon.onrender.com/api").trim();
const normalizedBaseUrl = rawUrl.endsWith("/api")
  ? rawUrl
  : `${rawUrl.replace(/\/+$/, "")}/api`;

export const api = axios.create({
  baseURL: normalizedBaseUrl,
});

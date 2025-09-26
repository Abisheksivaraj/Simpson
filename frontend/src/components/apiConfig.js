import axios from "axios";

export const API_URL = "https://simpson.onrender.com";
// export const API_URL = "http://localhost:8081"; // Backend base URL

// Get token from localStorage (or wherever you store it)
const token = localStorage.getItem("token");

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "", // only add if token exists
  },
});

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log("✅ API Success:", response.config.url, response.status);
    return response;
  },
  (error) => {
    console.error("❌ API Error:", {
      status: error.response?.status,
      url: error.config?.url,
      message: error.message,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);

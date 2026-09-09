import axios from "axios";

export const AUTH_API_URL = "http://localhost:3001/api/v1";

export const authClient = axios.create({
  baseURL: AUTH_API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

authClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

authClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
    }
    return Promise.reject(error);
  }
);

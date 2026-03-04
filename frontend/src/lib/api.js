import axios from "axios";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "../utils/authInterceptor";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Required for cookies (Google OAuth sessions)
});

// Add token to requests — in-memory only (SEC-07 §4.7)
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors — attempt refresh token rotation before logout (SEC-07)
let _refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Attempt refresh token rotation (single in-flight refresh)
      const refreshToken = getRefreshToken();
      if (refreshToken && !_refreshPromise) {
        _refreshPromise = api
          .post("/auth/refresh", { refresh_token: refreshToken })
          .then((res) => {
            const { access_token, refresh_token: newRefresh } = res.data;
            setTokens(access_token, newRefresh);
            return true;
          })
          .catch(() => {
            clearTokens();
            return false;
          })
          .finally(() => {
            _refreshPromise = null;
          });
      }

      if (_refreshPromise) {
        const renewed = await _refreshPromise;
        if (renewed) {
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${getAccessToken()}`;
          return api(originalRequest);
        }
      }

      // Refresh failed or no refresh token → logout
      clearTokens();
      window.location.href = "/login";
      return Promise.reject(error);
    }

    // Non-401 errors or already-retried 401 → reject normally
    if (error.response?.status === 401) {
      clearTokens();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Dashboard
export const getDashboardStats = () => api.get("/dashboard/stats");

// LinkedIn Events
export const getLinkedInEvents = () => api.get("/linkedin/events");
export const scrapeLinkedInEvents = () => api.post("/linkedin/scrape");

// Unified Contacts (CRM internal) - Primary contact API
export const getUnifiedContacts = (params = {}) => api.get("/contacts", { params });
export const getContactById = (id) => api.get(`/contacts/${id}`);

// DEPRECATED: HubSpot direct APIs removed - use getUnifiedContacts() instead
// getHubSpotContacts and syncHubSpotContacts have been removed

// Templates
export const getTemplates = () => api.get("/templates/");
export const createTemplate = (data) => api.post("/templates/", data);
export const updateTemplate = (id, data) => api.put(`/templates/${id}`, data);
export const deleteTemplate = (id) => api.delete(`/templates/${id}`);

// Campaigns
export const getCampaigns = () => api.get("/campaigns/");
export const createCampaign = (data) => api.post("/campaigns/", data);
export const getCampaign = (id) => api.get(`/campaigns/${id}`);
export const deleteCampaign = (id) => api.delete(`/campaigns/${id}`);
export const sendCampaignEmails = (data) => api.post("/emails/send", data);

// Email History
export const getEmailLogs = (limit = 50, skip = 0) => api.get(`/email-logs?limit=${limit}&skip=${skip}`);

// Settings
export const getSettings = () => api.get("/settings/");
export const updateSettings = (data) => api.put("/settings/", data);

export default api;

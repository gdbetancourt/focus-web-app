import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Required for cookies (Google OAuth sessions)
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors — retry once before logout to prevent
// spurious logouts under rapid-fire requests (BUG-6)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        return await api(originalRequest);
      } catch (retryError) {
        // Retry also failed → genuine auth failure, logout
        localStorage.removeItem("token");
        window.location.href = "/login";
        return Promise.reject(retryError);
      }
    }
    // Non-401 errors or already-retried 401 → reject normally
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
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

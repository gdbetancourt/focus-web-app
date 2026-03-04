/**
 * SEC-07 — Interceptor HTTP para renovación automática de access token
 */

let _accessToken  = null;
let _refreshToken = null;

export function setTokens(accessToken, refreshToken) {
  _accessToken  = accessToken;
  _refreshToken = refreshToken;
}

export function getAccessToken() {
  return _accessToken;
}

export function getRefreshToken() {
  return _refreshToken;
}

export function clearTokens() {
  _accessToken  = null;
  _refreshToken = null;
}

let _refreshPromise = null;

async function _attemptRefresh() {
  if (!_refreshToken) {
    return false;
  }

  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: _refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      return false;
    }

    const data = await response.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

export async function authenticatedFetch(url, options = {}) {
  const _makeRequest = (token) =>
    fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  let response = await _makeRequest(_accessToken);

  if (response.status === 401 && _refreshToken) {
    if (!_refreshPromise) {
      _refreshPromise = _attemptRefresh().finally(() => {
        _refreshPromise = null;
      });
    }

    const renewed = await _refreshPromise;

    if (!renewed) {
      window.location.href = "/login";
      return response;
    }

    response = await _makeRequest(_accessToken);
  }

  return response;
}

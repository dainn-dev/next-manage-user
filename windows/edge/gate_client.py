"""HTTP client for the backend gate endpoints.

Wraps the three edge-facing calls, all authenticated with the ``X-Gate-Key``
header (Phase 1.3 / 3.1 / 3.2):

* ``POST /api/gates/register``          -> self-registration, returns the gate id
* ``POST /api/gates/{id}/heartbeat``    -> liveness ping
* ``POST /api/vehicles/check-vehicle``  -> plate check tagged with gateId

The response cache and per-minute rate limiter are carried over verbatim from
``license_plate_monitor.py`` so the edge keeps the same "don't hammer the
backend" behaviour that the desktop app relied on.
"""

import time

import requests

from config_manager import config_manager


# Shared HTTP headers. A browser-like User-Agent is kept because some reverse
# proxies in front of the backend reject default python-requests UAs.
_BASE_HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "User-Agent": "VisionLPR-Edge/1.0 (headless)",
}


class GateClient:
    """Stateful client for one gate (one edge process == one gate)."""

    def __init__(self, config=config_manager):
        self.config = config
        # cache_key -> {"timestamp": float, "response": dict}
        self._cache = {}
        # timestamps of recent check-vehicle requests, for rate limiting
        self._request_times = []

    # ------------------------------------------------------------------ auth
    def _headers(self):
        headers = dict(_BASE_HEADERS)
        gate_key = self.config.get_gate_key()
        if gate_key:
            headers["X-Gate-Key"] = gate_key
        else:
            print("WARNING: gate key not set (api.gate_key / GATE_API_KEY). "
                  "The backend will reject gate calls with 401 once GATE_API_KEY is configured.")
        return headers

    def _multipart_headers(self):
        """Headers for a multipart POST: like ``_headers`` but without the JSON
        Content-Type so ``requests`` can set the multipart boundary itself."""
        headers = self._headers()
        headers.pop("Content-Type", None)
        return headers

    def _proxies(self, url):
        # Bypass any system proxy for loopback so localhost dev works.
        if "localhost" in url or "127.0.0.1" in url:
            return {"http": None, "https": None}
        return None

    # -------------------------------------------------------------- register
    def register(self):
        """Register (upsert) this gate. Returns the gate id, or None on failure.

        Sends the persisted gate id when present so the backend upserts by id,
        otherwise it upserts by unique name.
        """
        url = f"{self.config.get_api_base_url()}/api/gates/register"
        payload = {
            "name": self.config.get_gate_name(),
            "location": self.config.get_gate_location(),
            "cameraRtspUrl": self.config.get_gate_camera_rtsp(),
        }
        existing_id = self.config.get_gate_id()
        if existing_id:
            payload["id"] = existing_id

        if not payload["name"]:
            print("ERROR: gate.name is empty in config; cannot register (backend requires a name).")
            return None

        try:
            resp = requests.post(
                url, json=payload, headers=self._headers(),
                timeout=self.config.get_api_timeout(), proxies=self._proxies(url),
            )
            if resp.status_code == 200:
                gate = resp.json()
                gate_id = gate.get("id")
                print(f"Gate registered: id={gate_id} name={gate.get('name')} status={gate.get('status')}")
                return gate_id
            print(f"ERROR: gate registration failed: {resp.status_code} - {resp.text[:200]}")
            return None
        except requests.exceptions.RequestException as exc:
            print(f"ERROR: gate registration request failed: {exc}")
            return None

    # ------------------------------------------------------------- heartbeat
    def heartbeat(self, gate_id):
        """Send a liveness ping. Returns True on success."""
        if not gate_id:
            return False
        url = f"{self.config.get_api_base_url()}/api/gates/{gate_id}/heartbeat"
        try:
            resp = requests.post(
                url, json={}, headers=self._headers(),
                timeout=self.config.get_api_timeout(), proxies=self._proxies(url),
            )
            if resp.status_code == 200:
                return True
            print(f"WARNING: heartbeat failed: {resp.status_code} - {resp.text[:200]}")
            return False
        except requests.exceptions.RequestException as exc:
            print(f"WARNING: heartbeat request failed: {exc}")
            return False

    # ------------------------------------------------------------- rate limit
    def _clean_expired_cache(self):
        now = time.time()
        normal = self.config.get_cache_duration()
        error = self.config.get_connection_error_cache_duration()
        expired = []
        for key, data in self._cache.items():
            duration = error if data["response"].get("connection_error", False) else normal
            if now - data["timestamp"] >= duration:
                expired.append(key)
        for key in expired:
            del self._cache[key]

    def _get_cached(self, cache_key):
        data = self._cache.get(cache_key)
        if not data:
            return None
        now = time.time()
        duration = (self.config.get_connection_error_cache_duration()
                    if data["response"].get("connection_error", False)
                    else self.config.get_cache_duration())
        if now - data["timestamp"] < duration:
            return data["response"]
        return None

    def _cache_response(self, cache_key, response):
        self._cache[cache_key] = {"timestamp": time.time(), "response": response}

    def _check_rate_limit(self):
        if not self.config.get_rate_limit_enabled():
            return True, None
        now = time.time()
        max_per_minute = self.config.get_rate_limit_max_requests()
        self._request_times = [t for t in self._request_times if now - t < 60]
        if len(self._request_times) >= max_per_minute:
            return False, f"Rate limit exceeded: {len(self._request_times)}/{max_per_minute} req/min"
        return True, None

    # ---------------------------------------------------------- check vehicle
    def check_vehicle(self, license_plate, panel_type, gate_id=None, snapshot=None):
        """POST a detected plate to the backend, with caching + rate limiting.

        When ``snapshot`` (JPEG bytes) is supplied the request is sent as multipart
        so the backend can store it as evidence and link it to the created log
        (Phase 4.2); otherwise a plain JSON body is sent as before. The snapshot
        does not affect the cache key (it has no bearing on the approval result).

        Returns a response dict shaped like the desktop app's:
        ``{success, message, approved?, cached?, rate_limited?, connection_error?}``.
        """
        self._clean_expired_cache()
        cache_key = f"{license_plate}_{panel_type}"

        cached = self._get_cached(cache_key)
        if cached is not None:
            result = dict(cached)
            result["cached"] = True
            return result

        ok, err = self._check_rate_limit()
        if not ok:
            return {"success": False, "message": f"Rate limited ({err})", "rate_limited": True}

        url = self.config.get_api_url()
        payload = {"licensePlateNumber": license_plate, "type": panel_type}
        if gate_id:
            payload["gateId"] = gate_id

        try:
            if snapshot:
                # Multipart: form fields + the cropped plate JPEG.
                files = {"snapshot": ("plate.jpg", snapshot, "image/jpeg")}
                resp = requests.post(
                    url, data=payload, files=files, headers=self._multipart_headers(),
                    timeout=self.config.get_api_timeout(), proxies=self._proxies(url),
                )
            else:
                resp = requests.post(
                    url, json=payload, headers=self._headers(),
                    timeout=self.config.get_api_timeout(), proxies=self._proxies(url),
                )
            self._request_times.append(time.time())

            if resp.status_code == 200:
                try:
                    body = resp.json()
                    response = {
                        "success": True,
                        "message": body.get("message", "OK"),
                        "approved": body.get("approved", False),
                        "licensePlateNumber": body.get("licensePlateNumber", license_plate),
                        "type": body.get("type", panel_type),
                    }
                except ValueError:
                    response = {"success": True, "message": "OK"}
            else:
                response = {"success": False,
                            "message": f"API error {resp.status_code}: {resp.text[:200]}"}
            self._cache_response(cache_key, response)
            return response
        except requests.exceptions.RequestException as exc:
            error = {"success": False, "message": f"Network error: {exc}", "connection_error": True}
            self._request_times.append(time.time())
            self._cache_response(cache_key, error)
            return error

// ===== Smart Attendance System - Geolocation Service =====

class GeolocationService {
    constructor() {
        this.currentPosition = null;
        this.watchId = null;
    }

    // Check if geolocation is available
    isAvailable() {
        return 'geolocation' in navigator;
    }

    // Get current position
    getCurrentPosition(options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.isAvailable()) {
                reject(new Error('Geolocation is not supported by this browser'));
                return;
            }

            const defaultOptions = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentPosition = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    };
                    resolve(this.currentPosition);
                },
                (error) => {
                    let message = 'Unknown error';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            message = 'Location permission denied. Please enable location access.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            message = 'Location information is unavailable.';
                            break;
                        case error.TIMEOUT:
                            message = 'Location request timed out.';
                            break;
                    }
                    reject(new Error(message));
                },
                { ...defaultOptions, ...options }
            );
        });
    }

    // Watch position continuously
    watchPosition(callback, errorCallback, options = {}) {
        if (!this.isAvailable()) {
            errorCallback(new Error('Geolocation is not supported'));
            return null;
        }

        const defaultOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.currentPosition = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                callback(this.currentPosition);
            },
            errorCallback,
            { ...defaultOptions, ...options }
        );

        return this.watchId;
    }

    // Stop watching position
    stopWatching() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    // Calculate distance between two points (Haversine formula)
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    }

    // Check if user is within geofence
    isWithinGeofence(centerLat, centerLon, radius) {
        if (!this.currentPosition) return false;

        const distance = this.calculateDistance(
            this.currentPosition.latitude,
            this.currentPosition.longitude,
            centerLat,
            centerLon
        );

        return {
            isWithin: distance <= radius,
            distance: Math.round(distance),
            accuracy: this.currentPosition.accuracy
        };
    }
}

// WiFi Detection Service
class WiFiService {
    constructor() {
        this.connection = null;
    }

    // Get network information (limited on most browsers)
    getNetworkInfo() {
        return new Promise((resolve) => {
            // Check for Network Information API
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

            if (connection) {
                resolve({
                    type: connection.type || connection.effectiveType,
                    downlink: connection.downlink,
                    rtt: connection.rtt,
                    saveData: connection.saveData
                });
            } else {
                // Fallback - try to detect via WebRTC
                this.getIPAddressViaRTC().then(ip => {
                    resolve({
                        type: 'unknown',
                        ipAddress: ip,
                        detected: true
                    });
                }).catch(() => {
                    resolve({
                        type: 'unknown',
                        detected: false
                    });
                });
            }
        });
    }

    // Get IP address using WebRTC (works in most browsers)
    getIPAddressViaRTC() {
        return new Promise((resolve, reject) => {
            try {
                const pc = new RTCPeerConnection({ iceServers: [] });
                pc.createDataChannel('');

                pc.onicecandidate = (event) => {
                    if (!event.candidate) {
                        pc.close();
                        reject(new Error('No candidates found'));
                        return;
                    }

                    const candidate = event.candidate.candidate;
                    const ipMatch = candidate.match(/(\d{1,3}\.){3}\d{1,3}/);

                    if (ipMatch) {
                        pc.close();
                        resolve(ipMatch[0]);
                    }
                };

                pc.createOffer()
                    .then(offer => pc.setLocalDescription(offer))
                    .catch(reject);

                // Timeout after 5 seconds
                setTimeout(() => {
                    pc.close();
                    reject(new Error('Timeout'));
                }, 5000);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Get device IP from server
    async getPublicIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.error('Failed to get public IP:', error);
            return null;
        }
    }

    // Simulate WiFi connection check (actual SSID detection requires native app)
    async checkWiFiConnection(expectedSSID) {
        // In a real implementation, this would use native mobile APIs
        // For web, we can only check network type
        const networkInfo = await this.getNetworkInfo();

        return {
            connected: networkInfo.type === 'wifi',
            networkInfo,
            // Note: Actual SSID detection requires native app permissions
            ssidVerification: 'requires_manual_confirmation'
        };
    }

    // Get WiFi data for attendance verification
    async getWiFiData(ssid) {
        const ipAddress = await this.getIPAddressViaRTC().catch(() => null);
        const networkInfo = await this.getNetworkInfo();

        return {
            ssid: ssid, // Provided by user
            ipAddress,
            macAddress: null, // Cannot get MAC address from web
            deviceInfo: navigator.userAgent,
            networkType: networkInfo.type
        };
    }
}

// Create global instances
window.geoService = new GeolocationService();
window.wifiService = new WiFiService();

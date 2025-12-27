// ===== Smart Attendance System - Face Verification Service =====

class FaceVerificationService {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.stream = null;
        this.isInitialized = false;
        this.captureInterval = null;
    }

    // Initialize camera
    async initCamera(videoElementId, canvasElementId) {
        try {
            this.video = document.getElementById(videoElementId);
            this.canvas = document.getElementById(canvasElementId);
            this.ctx = this.canvas.getContext('2d');

            // Check camera support
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera not supported in this browser');
            }

            // Get camera stream
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user' // Front camera
                }
            });

            this.video.srcObject = this.stream;
            await this.video.play();

            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Camera initialization failed:', error);
            throw error;
        }
    }

    // Capture image from video
    captureImage() {
        if (!this.isInitialized) {
            throw new Error('Camera not initialized');
        }

        // Draw current video frame to canvas
        this.ctx.drawImage(this.video, 0, 0);

        // Get image as base64
        const imageData = this.canvas.toDataURL('image/jpeg', 0.8);
        return imageData;
    }

    // Stop camera
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.video) {
            this.video.srcObject = null;
        }
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
        this.isInitialized = false;
    }

    // Simple face detection using canvas analysis
    detectFaceInFrame() {
        if (!this.isInitialized) return false;

        // Draw current frame
        this.ctx.drawImage(this.video, 0, 0);

        // Get image data
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;

        // Simple skin tone detection
        let skinPixels = 0;
        const totalPixels = this.canvas.width * this.canvas.height;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(this.canvas.width, this.canvas.height) / 3;

        // Check center region for skin-like pixels
        for (let y = centerY - radius; y < centerY + radius; y++) {
            for (let x = centerX - radius; x < centerX + radius; x++) {
                if (Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)) > radius) continue;

                const i = (Math.floor(y) * this.canvas.width + Math.floor(x)) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Simple skin tone detection (works for various skin tones)
                if (this.isSkinTone(r, g, b)) {
                    skinPixels++;
                }
            }
        }

        // If enough skin pixels detected in center, assume face is present
        const skinPercentage = skinPixels / (Math.PI * radius * radius);
        return skinPercentage > 0.3; // At least 30% skin pixels
    }

    // Check if pixel is skin tone
    isSkinTone(r, g, b) {
        // YCbCr color space conversion for skin detection
        const y = 0.299 * r + 0.587 * g + 0.114 * b;
        const cb = 128 - 0.169 * r - 0.331 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.419 * g - 0.081 * b;

        // Skin tone ranges in YCbCr
        return cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
    }

    // Generate simple face encoding (for demo purposes)
    generateFaceEncoding() {
        if (!this.isInitialized) return null;

        this.ctx.drawImage(this.video, 0, 0);
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;

        // Generate a simple hash-like encoding from the face region
        const encoding = [];
        const blockSize = 20;
        const startX = Math.floor(this.canvas.width / 4);
        const startY = Math.floor(this.canvas.height / 4);
        const endX = Math.floor(3 * this.canvas.width / 4);
        const endY = Math.floor(3 * this.canvas.height / 4);

        for (let y = startY; y < endY; y += blockSize) {
            for (let x = startX; x < endX; x += blockSize) {
                let avgR = 0, avgG = 0, avgB = 0, count = 0;

                for (let by = 0; by < blockSize && y + by < endY; by++) {
                    for (let bx = 0; bx < blockSize && x + bx < endX; bx++) {
                        const i = ((y + by) * this.canvas.width + (x + bx)) * 4;
                        avgR += data[i];
                        avgG += data[i + 1];
                        avgB += data[i + 2];
                        count++;
                    }
                }

                encoding.push(
                    Math.round(avgR / count) / 255,
                    Math.round(avgG / count) / 255,
                    Math.round(avgB / count) / 255
                );
            }
        }

        return encoding;
    }

    // Verify face against stored encoding
    verifyFace(storedEncoding, threshold = 0.7) {
        const currentEncoding = this.generateFaceEncoding();

        if (!currentEncoding || !storedEncoding) {
            return { verified: false, confidence: 0, error: 'Could not generate encoding' };
        }

        // Calculate similarity
        const minLength = Math.min(currentEncoding.length, storedEncoding.length);
        let sumSquares = 0;

        for (let i = 0; i < minLength; i++) {
            sumSquares += Math.pow(currentEncoding[i] - storedEncoding[i], 2);
        }

        const distance = Math.sqrt(sumSquares / minLength);
        const confidence = Math.max(0, 1 - distance);

        return {
            verified: confidence >= threshold,
            confidence: Math.round(confidence * 100) / 100,
            threshold
        };
    }

    // Start continuous face detection
    startContinuousDetection(callback, interval = 500) {
        if (!this.isInitialized) {
            throw new Error('Camera not initialized');
        }

        this.captureInterval = setInterval(() => {
            const faceDetected = this.detectFaceInFrame();
            callback(faceDetected);
        }, interval);
    }

    // Create verification UI
    createVerificationUI(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="face-verification-container">
                <div class="face-scanner" id="face-scanner">
                    <video id="face-video" autoplay playsinline muted></video>
                    <canvas id="face-canvas" style="display: none;"></canvas>
                    <div class="scanner-overlay">
                        <div class="scanner-frame"></div>
                        <div class="scanner-line"></div>
                    </div>
                    <div class="face-status" id="face-status">
                        <i class="bi bi-person-x fs-1"></i>
                        <span>Position your face in the frame</span>
                    </div>
                </div>
                <div class="verification-status mt-3 text-center">
                    <div id="verification-message" class="text-muted">
                        Please allow camera access
                    </div>
                    <div class="progress mt-2" style="height: 8px; display: none;" id="verification-progress">
                        <div class="progress-bar bg-success" style="width: 0%"></div>
                    </div>
                </div>
                <div class="verification-buttons mt-3 text-center">
                    <button class="btn btn-gradient-success" id="verify-face-btn" disabled>
                        <i class="bi bi-camera me-2"></i>Verify Face
                    </button>
                </div>
            </div>
            <style>
                .face-verification-container {
                    max-width: 400px;
                    margin: 0 auto;
                }
                .face-scanner {
                    position: relative;
                    width: 300px;
                    height: 300px;
                    margin: 0 auto;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 4px solid #4f46e5;
                    background: #1f2937;
                }
                .face-scanner video {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .scanner-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                }
                .scanner-frame {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 180px;
                    height: 240px;
                    border: 2px dashed rgba(255, 255, 255, 0.5);
                    border-radius: 50% 50% 45% 45%;
                }
                .scanner-line {
                    position: absolute;
                    width: 100%;
                    height: 3px;
                    background: linear-gradient(90deg, transparent, #4f46e5, transparent);
                    animation: scanLine 2s infinite;
                }
                @keyframes scanLine {
                    0% { top: 0; }
                    50% { top: 100%; }
                    100% { top: 0; }
                }
                .face-status {
                    position: absolute;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .face-status.detected {
                    background: rgba(16, 185, 129, 0.9);
                }
                .face-status.detected i {
                    color: white;
                }
            </style>
        `;

        return {
            video: container.querySelector('#face-video'),
            canvas: container.querySelector('#face-canvas'),
            status: container.querySelector('#face-status'),
            message: container.querySelector('#verification-message'),
            progress: container.querySelector('#verification-progress'),
            button: container.querySelector('#verify-face-btn')
        };
    }
}

// Create global instance
window.faceService = new FaceVerificationService();

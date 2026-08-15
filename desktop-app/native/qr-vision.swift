import Foundation
import Vision
import AppKit

// Kuiqr native macOS Vision QR detector.
// Usage: qr-vision <image-path>
// Output: prints the first detected QR payload to stdout (UTF-8).
//         prints nothing and exits 0 if no QR code is found.

if CommandLine.arguments.count < 2 {
    // No image path provided.
    exit(0)
}

let imagePath = CommandLine.arguments[1]

// Load the image file.
guard FileManager.default.fileExists(atPath: imagePath),
      let nsImage = NSImage(contentsOfFile: imagePath),
      let cgImage = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    exit(0)
}

// Use a dispatch semaphore so the async Vision callback blocks until done.
let semaphore = DispatchSemaphore(value: 0)
var foundPayload: String? = nil

let request = VNDetectBarcodesRequest { request, error in
    defer { semaphore.signal() }
    if let error = error {
        // Silently ignore Vision errors; fallback decoder will handle it.
        return
    }
    guard let results = request.results as? [VNBarcodeObservation] else { return }
    for observation in results {
        if observation.symbology == .qr,
           let payload = observation.payloadStringValue,
           !payload.isEmpty {
            foundPayload = payload
            return
        }
    }
}
request.symbologies = [.qr]

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try? handler.perform([request])

// Wait a short time for the async callback (it usually completes synchronously).
_ = semaphore.wait(timeout: .now() + .milliseconds(500))

if let payload = foundPayload {
    if let data = payload.data(using: .utf8) {
        FileHandle.standardOutput.write(data)
    }
}

// An image on its way into a prompt — the SPA's `attachments.ts`. A picked,
// pasted or dropped image is read into two forms: the full-resolution bytes
// handed to the agent, and a small JPEG thumbnail that stands for it in the
// composer's chip and, once sent, in the message's preview — since a sent
// message keeps only the thumbnail, it is made large enough to stay crisp
// in the enlarged view. A format the agent's CLI cannot open — a photo
// library's HEIC, a pasted TIFF — is re-encoded on the way in (see
// `Delivered`), since the server drops what it cannot name.
import AppKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct ComposerAttachment: Identifiable, Equatable {
    let id = UUID()
    let name: String
    let mimeType: String
    /// Raw base64, no `data:` prefix, of the full-resolution image.
    let data: String
    /// A `data:` URL of the thumbnail, as the message will keep it.
    let thumbnail: String
    let preview: NSImage
    /// The full image, for the enlarged view of a pending pick.
    let full: NSImage

    static let maxBytes = 15 * 1024 * 1024
    private static let thumbnailMaxEdge: CGFloat = 1600

    var upload: ChatImageUpload {
        ChatImageUpload(name: name, data: data, thumbnail: thumbnail)
    }

    static func == (a: ComposerAttachment, b: ComposerAttachment) -> Bool { a.id == b.id }

    /// The image behind a file URL, or nil for a file that is not an image,
    /// or too large to read into memory.
    static func read(url: URL) -> ComposerAttachment? {
        guard let type = UTType(filenameExtension: url.pathExtension), type.conforms(to: .image),
            let bytes = try? Data(contentsOf: url)
        else { return nil }
        return read(bytes: bytes, name: url.lastPathComponent, type: type)
    }

    static func read(bytes: Data, name: String, type: UTType) -> ComposerAttachment? {
        guard bytes.count <= maxBytes, let full = NSImage(data: bytes),
            let delivered = Delivered(bytes: bytes, name: name, type: type)
        else { return nil }
        let mimeType = delivered.type.preferredMIMEType ?? "image/png"
        let downscaled = jpeg(from: delivered.bytes, maxEdge: thumbnailMaxEdge, quality: 0.72)
        let thumbnail = downscaled ?? delivered.bytes
        guard let preview = NSImage(data: thumbnail) else { return nil }
        return ComposerAttachment(
            name: delivered.name, mimeType: mimeType,
            data: delivered.bytes.base64EncodedString(),
            thumbnail: "data:\(downscaled == nil ? mimeType : "image/jpeg");base64,\(thumbnail.base64EncodedString())",
            preview: preview, full: full)
    }

    /// The images on a pasteboard — files first, then pasted bitmaps, which
    /// have no name of their own.
    static func read(pasteboard: NSPasteboard) -> [ComposerAttachment] {
        if let urls = pasteboard.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL],
            !urls.isEmpty
        {
            return urls.compactMap(read(url:))
        }
        for type in [NSPasteboard.PasteboardType.png, .tiff] {
            guard let bytes = pasteboard.data(forType: type) else { continue }
            let utType: UTType = type == .png ? .png : .tiff
            if let attachment = read(bytes: bytes, name: "Pasted image.\(utType.preferredFilenameExtension ?? "png")", type: utType) {
                return [attachment]
            }
        }
        return []
    }

    /// The bytes as the agent will read them. The server decodes an upload to
    /// a temp file it names from the extension, and writes only the formats
    /// the CLIs read (`dropped-image.ts`), so anything else — a photo
    /// library's HEIC, a pasted TIFF — is re-encoded to JPEG here. It would
    /// otherwise be thrown away server-side, after the composer had already
    /// shown its chip and the message had been sent.
    private struct Delivered {
        let bytes: Data
        let name: String
        let type: UTType

        init?(bytes: Data, name: String, type: UTType) {
            if ComposerAttachment.deliveredTypes.contains(where: type.conforms(to:)) {
                (self.bytes, self.name, self.type) = (bytes, name, type)
                return
            }
            guard let edge = ComposerAttachment.pixelEdge(of: bytes),
                let jpeg = ComposerAttachment.jpeg(from: bytes, maxEdge: edge, quality: 0.92),
                jpeg.count <= ComposerAttachment.maxBytes
            else { return nil }
            self.bytes = jpeg
            self.name = "\((name as NSString).deletingPathExtension).jpg"
            self.type = .jpeg
        }
    }

    private static let deliveredTypes: Set<UTType> = [.png, .jpeg, .gif, .webP, .bmp, .svg]

    /// The longest edge of the image as it was encoded, so a re-encode keeps
    /// the resolution it came at.
    private static func pixelEdge(of bytes: Data) -> CGFloat? {
        guard let source = CGImageSourceCreateWithData(bytes as CFData, nil),
            let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
            let width = properties[kCGImagePropertyPixelWidth] as? CGFloat,
            let height = properties[kCGImagePropertyPixelHeight] as? CGFloat
        else { return nil }
        return max(width, height)
    }

    /// `bytes` as a JPEG no longer than `maxEdge`, or nil where the image
    /// cannot be drawn. Drawn through the thumbnail API at every size, since
    /// that is what applies the EXIF rotation a phone's photo carries.
    private static func jpeg(from bytes: Data, maxEdge: CGFloat, quality: Double) -> Data? {
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxEdge,
        ]
        guard let source = CGImageSourceCreateWithData(bytes as CFData, nil),
            let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
        else { return nil }
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil) else {
            return nil
        }
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { return nil }
        return output as Data
    }
}

/// A `data:` URL as the wire carries an attachment's thumbnail, decoded.
enum DataURL {
    static func image(_ url: String) -> NSImage? {
        guard url.hasPrefix("data:"), let comma = url.firstIndex(of: ",") else { return nil }
        let payload = String(url[url.index(after: comma)...])
        guard let bytes = Data(base64Encoded: payload, options: .ignoreUnknownCharacters) else { return nil }
        return NSImage(data: bytes)
    }
}

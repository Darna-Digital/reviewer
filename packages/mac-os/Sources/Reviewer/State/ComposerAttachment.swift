// An image on its way into a prompt — the SPA's `attachments.ts`. A picked,
// pasted or dropped image is read into two forms: the full-resolution bytes
// handed to the agent, and a small JPEG thumbnail that stands for it in the
// composer's chip and, once sent, in the message's preview — since a sent
// message keeps only the thumbnail, it is made large enough to stay crisp
// in the enlarged view.
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
        guard bytes.count <= maxBytes, let full = NSImage(data: bytes) else { return nil }
        let mimeType = type.preferredMIMEType ?? "image/png"
        let downscaled = thumbnailData(of: bytes)
        let thumbnail = downscaled ?? bytes
        guard let preview = NSImage(data: thumbnail) else { return nil }
        return ComposerAttachment(
            name: name, mimeType: mimeType,
            data: bytes.base64EncodedString(),
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

    /// `bytes` downscaled to a JPEG no longer than the thumbnail edge, or
    /// nil where the image cannot be drawn — the original then stands in.
    private static func thumbnailData(of bytes: Data) -> Data? {
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: thumbnailMaxEdge,
        ]
        guard let source = CGImageSourceCreateWithData(bytes as CFData, nil),
            let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
        else { return nil }
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil) else {
            return nil
        }
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.72] as CFDictionary)
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

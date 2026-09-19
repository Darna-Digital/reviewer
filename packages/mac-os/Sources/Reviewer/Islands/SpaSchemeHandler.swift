// Serves a built SPA out of a directory over `reviewer://app`: a path that
// names a file on disk is
// that file; any other path a *navigation* asks for is the SPA's shell
// document, since the router owns everything below the root; and anything
// else — a script or stylesheet the build no longer has — is a plain 404
// rather than HTML dressed up as one.
//
// The `Accept` header is how a navigation is told from a fetch: WebKit asks
// for `text/html` on a document load and never on a script, a style or a
// `fetch()`. The path is no help — a route can end in `.ts`.
import Foundation
import UniformTypeIdentifiers
import WebKit

final class SpaSchemeHandler: NSObject, WKURLSchemeHandler {
    private let directory: URL
    private let shellDocument: URL

    init(directory: URL) {
        self.directory = directory
        self.shellDocument = directory.appending(path: "_shell.html")
    }

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        let path = url.path.isEmpty ? "/" : url.path
        let candidate = directory.appending(path: String(path.dropFirst())).standardizedFileURL
        let onDisk = candidate.path.hasPrefix(directory.standardizedFileURL.path) && isFile(candidate)

        if onDisk {
            respond(task, url: url, file: candidate)
        } else if isNavigation(task.request) {
            respond(task, url: url, file: shellDocument)
        } else {
            notFound(task, url: url)
        }
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}

    private func isFile(_ url: URL) -> Bool {
        var isDirectory: ObjCBool = false
        return FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory) && !isDirectory.boolValue
    }

    private func isNavigation(_ request: URLRequest) -> Bool {
        request.value(forHTTPHeaderField: "Accept")?.contains("text/html") ?? false
    }

    private func respond(_ task: any WKURLSchemeTask, url: URL, file: URL) {
        guard let data = try? Data(contentsOf: file) else {
            notFound(task, url: url)
            return
        }
        let type = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        let headers = [
            "Content-Type": type.hasPrefix("text/") || type.contains("javascript") || type.contains("json")
                ? "\(type); charset=utf-8" : type,
            "Content-Length": String(data.count),
            "Cache-Control": "no-cache",
        ]
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    private func notFound(_ task: any WKURLSchemeTask, url: URL) {
        let response = HTTPURLResponse(
            url: url, statusCode: 404, httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "text/plain; charset=utf-8"])!
        task.didReceive(response)
        task.didReceive(Data("Not found".utf8))
        task.didFinish()
    }
}

// Which highlight.js grammar a file gets, from its name. Only names we are
// sure about map; anything else opens as plain text rather than through
// highlight.js's auto-detection, which is slow on a big file and guesses
// wrong often enough to be worse than no colour at all.
import Foundation

enum CodeLanguage {
    static func forFile(named name: String) -> String? {
        let lowered = name.lowercased()
        if let byName = byFileName[lowered] { return byName }
        let ext = (lowered as NSString).pathExtension
        return byExtension[ext]
    }

    private static let byFileName: [String: String] = [
        "dockerfile": "dockerfile",
        "makefile": "makefile",
        "gemfile": "ruby",
        "rakefile": "ruby",
        "podfile": "ruby",
        ".zshrc": "bash",
        ".bashrc": "bash",
        ".bash_profile": "bash",
        ".zprofile": "bash",
    ]

    private static let byExtension: [String: String] = [
        "swift": "swift",
        "ts": "typescript", "mts": "typescript", "cts": "typescript",
        // highlight.js has no TSX/JSX grammar of its own; the parent language
        // colours everything but the tag syntax, which is close enough.
        "tsx": "typescript", "jsx": "javascript",
        "js": "javascript", "mjs": "javascript", "cjs": "javascript",
        "json": "json", "jsonc": "json", "json5": "json",
        "yaml": "yaml", "yml": "yaml",
        "toml": "ini", "ini": "ini", "env": "bash",
        "md": "markdown", "mdx": "markdown", "markdown": "markdown",
        "html": "xml", "htm": "xml", "xml": "xml", "svg": "xml", "plist": "xml", "xib": "xml", "storyboard": "xml",
        "css": "css", "scss": "scss", "less": "less",
        "sh": "bash", "bash": "bash", "zsh": "bash",
        "py": "python", "rb": "ruby", "erb": "erb", "go": "go", "rs": "rust",
        "java": "java", "kt": "kotlin", "kts": "kotlin", "scala": "scala",
        "c": "c", "h": "c", "cpp": "cpp", "cc": "cpp", "hpp": "cpp", "m": "objectivec", "mm": "objectivec",
        "cs": "csharp", "php": "php", "sql": "sql", "graphql": "graphql", "gql": "graphql",
        "lua": "lua", "pl": "perl", "r": "r", "dart": "dart", "ex": "elixir", "exs": "elixir",
        "vue": "xml", "svelte": "xml", "astro": "xml",
        "diff": "diff", "patch": "diff", "proto": "protobuf", "tf": "terraform",
        "gradle": "gradle", "groovy": "groovy", "cmake": "cmake", "nix": "nix",
    ]
}

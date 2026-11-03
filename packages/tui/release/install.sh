#!/bin/sh
# Reviewer's terminal UI, in one line:
#
#   curl -fsSL https://reviewer.sh/install | bash
#
# Installs the latest release (or `--version X.Y.Z`) into ~/.reviewer
# (REVIEWER_HOME), and unless `--no-modify-path` makes `reviewer` a command: a
# link in ~/.local/bin when that is on PATH, or else ~/.reviewer/bin put on it:
#
#   ~/.reviewer/bin/reviewer                  → the release in use
#   ~/.reviewer/releases/<version>/           the TUI and the Reviewer server
#   ~/.reviewer/runtimes/node-v<…>-<os>-<arch>/bin/node
#                                             the Node.js the server runs on
#
# Node.js comes from nodejs.org, at the version the release pins, and is kept
# per version: an upgrade that keeps the pin downloads only the release. Both
# downloads are checked against the SHA-256s in the release's
# install-manifest.txt before anything is unpacked. The release used before
# stays beside the new one, so a server it started keeps running through an
# upgrade; older ones, and runtimes no release links, are removed.
#
# REVIEWER_RELEASE_URL points it at a folder of a release's files instead of
# GitHub (a `file://` URL works) — how CI installs a release before it ships.
#
# Run it again to upgrade (`reviewer upgrade` does). To uninstall, remove
# ~/.reviewer/bin, ~/.reviewer/releases and ~/.reviewer/runtimes, and
# ~/.local/bin/reviewer or the PATH line it added; the rest of ~/.reviewer is
# Reviewer's data, shared with the Mac app.
set -eu

REPO="Darna-Digital/reviewer"
home="${REVIEWER_HOME:-$HOME/.reviewer}"
version=""
modify_path=1

say() { printf '%s\n' "$*"; }
fail() {
  printf 'reviewer: %s\n' "$*" >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    -v | --version)
      [ $# -ge 2 ] || fail "--version takes a version, like 0.0.40"
      version="${2#v}"
      shift 2
      ;;
    --no-modify-path)
      modify_path=0
      shift
      ;;
    -h | --help)
      say "usage: install [--version X.Y.Z] [--no-modify-path]   (REVIEWER_HOME=$home)"
      exit 0
      ;;
    *) fail "unknown option $1" ;;
  esac
done

command -v curl >/dev/null 2>&1 || fail "curl is needed"
command -v tar >/dev/null 2>&1 || fail "tar is needed"
if command -v sha256sum >/dev/null 2>&1; then
  sha256() { sha256sum "$1" | cut -d' ' -f1; }
elif command -v shasum >/dev/null 2>&1; then
  sha256() { shasum -a 256 "$1" | cut -d' ' -f1; }
else
  fail "sha256sum or shasum is needed"
fi

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) fail "no release for $(uname -s) — Reviewer runs on macOS and Linux" ;;
esac
case "$(uname -m)" in
  arm64 | aarch64) arch=arm64 ;;
  x86_64 | amd64) arch=x64 ;;
  *) fail "no release for $(uname -m)" ;;
esac
# A shell under Rosetta reports x86_64 on an Apple silicon Mac.
if [ "$os" = darwin ] && [ "$arch" = x64 ] &&
  [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ]; then
  arch=arm64
fi
if [ "$os" = linux ] && { [ -f /etc/alpine-release ] || ldd --version 2>&1 | grep -qi musl; }; then
  fail "no release for musl Linux (Alpine) yet — Node.js and the TUI are built against glibc"
fi

if [ -n "${REVIEWER_RELEASE_URL:-}" ]; then
  base="$REVIEWER_RELEASE_URL"
elif [ -n "$version" ]; then
  base="https://github.com/${REPO}/releases/download/v${version}"
else
  base="https://github.com/${REPO}/releases/latest/download"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM

fetch() { curl -fsSL --retry 3 -o "$2" "$1"; }

fetch "${base}/install-manifest.txt" "${tmp}/manifest" ||
  fail "no release ${version:-found} at github.com/${REPO}/releases"
field() { awk -v key="$1" '$1 == key { print $2; exit }' "${tmp}/manifest"; }
checksum() { awk -v file="$1" '$1 == "sha256" && $2 == file { print $3; exit }' "${tmp}/manifest"; }

version="$(field version)"
node_version="$(field node)"
[ -n "$version" ] && [ -n "$node_version" ] || fail "the release's install-manifest.txt is unreadable"

# Downloads `file` from `url` into the scratch folder, failing unless its
# SHA-256 is the one the manifest lists for it.
verified() {
  url="$1"
  file="$2"
  expected="$(checksum "$file")"
  [ -n "$expected" ] || fail "the release lists no checksum for ${file}"
  fetch "$url" "${tmp}/${file}" || fail "could not download ${url}"
  [ "$(sha256 "${tmp}/${file}")" = "$expected" ] || fail "${file} does not match its checksum — not installed"
}

runtime="${home}/runtimes/node-v${node_version}-${os}-${arch}"
if [ ! -x "${runtime}/bin/node" ]; then
  node_name="node-v${node_version}-${os}-${arch}"
  say "Fetching Node.js ${node_version} for the Reviewer server…"
  verified "https://nodejs.org/dist/v${node_version}/${node_name}.tar.gz" "${node_name}.tar.gz"
  tar -xzf "${tmp}/${node_name}.tar.gz" -C "$tmp" "${node_name}/bin/node"
  mkdir -p "${runtime}.partial/bin" "${home}/runtimes"
  mv "${tmp}/${node_name}/bin/node" "${runtime}.partial/bin/node"
  rm -rf "$runtime"
  mv "${runtime}.partial" "$runtime"
fi

asset="reviewer-${os}-${arch}"
release="${home}/releases/${version}"
say "Installing Reviewer ${version}…"
verified "${base}/${asset}.tar.gz" "${asset}.tar.gz"
tar -xzf "${tmp}/${asset}.tar.gz" -C "$tmp"
[ -x "${tmp}/${asset}/reviewer" ] || fail "${asset}.tar.gz holds no reviewer binary"
ln -s "${runtime}/bin/node" "${tmp}/${asset}/server/node"
mkdir -p "${home}/releases" "${home}/bin"
rm -rf "${release}.partial"
mv "${tmp}/${asset}" "${release}.partial"
rm -rf "$release"
mv "${release}.partial" "$release"

# The link is swapped by a rename, so no shell ever finds bin/reviewer missing.
link="${home}/bin/reviewer"
previous="$(readlink "$link" 2>/dev/null || true)"
ln -s "${release}/reviewer" "${link}.partial"
mv -f "${link}.partial" "$link"

previous_release="$(dirname "${previous:-/none/none}")"
for kept in "${home}/releases"/*; do
  [ -d "$kept" ] || continue
  [ "$kept" = "$release" ] || [ "$kept" = "$previous_release" ] || rm -rf "$kept"
done
for cached in "${home}/runtimes"/*; do
  [ -d "$cached" ] || continue
  in_use=0
  for kept in "${home}/releases"/*; do
    [ "$(readlink "${kept}/server/node" 2>/dev/null)" = "${cached}/bin/node" ] && in_use=1
  done
  [ "$in_use" = 1 ] || rm -rf "$cached"
done

bin="${home}/bin"
on_path() { case ":${PATH}:" in *":${1}:"*) return 0 ;; esac; return 1; }
# This script cannot change the PATH of the shell that ran it. Most setups
# already have ~/.local/bin on it, though, so a link there makes `reviewer`
# run in this terminal straight away; it points at bin/reviewer, so upgrades
# keep it current. A file there that is not a link is someone else's, and stays.
local_bin="$HOME/.local/bin"
shim="${local_bin}/reviewer"
if [ "$modify_path" = 1 ] && ! on_path "$bin" && on_path "$local_bin" &&
  { [ -L "$shim" ] || [ ! -e "$shim" ]; }; then
  mkdir -p "$local_bin"
  ln -s "$link" "${shim}.partial"
  mv -f "${shim}.partial" "$shim"
elif [ "$modify_path" = 1 ] && ! on_path "$bin"; then
  shown_bin="$(printf '%s' "$bin" | sed "s|^${HOME}|\$HOME|")"
  case "$(basename "${SHELL:-sh}")" in
    zsh)
      config="${ZDOTDIR:-$HOME}/.zshrc"
      line="export PATH=\"${shown_bin}:\$PATH\""
      ;;
    bash)
      config="$HOME/.bashrc"
      [ "$os" = darwin ] && config="$HOME/.bash_profile"
      line="export PATH=\"${shown_bin}:\$PATH\""
      ;;
    fish)
      config="$HOME/.config/fish/config.fish"
      line="fish_add_path ${shown_bin}"
      ;;
    *)
      config=""
      line="export PATH=\"${shown_bin}:\$PATH\""
      ;;
  esac
  if [ -n "$config" ]; then
    mkdir -p "$(dirname "$config")"
    if ! grep -qsF "$line" "$config"; then
      printf '\n# Reviewer\n%s\n' "$line" >>"$config"
      say "Added ${shown_bin} to PATH in ${config}."
    fi
    # Said on every run: this terminal lacks it even when the config already had it.
    say "New terminals have reviewer. To run it in this one now: ${line}"
  else
    say "Add ${shown_bin} to PATH to run reviewer: ${line}"
  fi
fi
if [ -n "${GITHUB_PATH:-}" ]; then
  printf '%s\n' "$bin" >>"$GITHUB_PATH"
fi

found="$(command -v reviewer 2>/dev/null || true)"
if [ -n "$found" ] && [ "$found" != "$link" ] && [ "$(readlink "$found" 2>/dev/null)" != "$link" ]; then
  say "Note: another reviewer is on PATH (${found}) — remove it, or it may run instead of this release."
fi

# The site's block wordmark (block-wordmark.tsx): its 39×5 grid of cells, #
# solid and + the 40% shadow, a cell to two columns so they come out square.
# Only for a terminal; a log gets the plain line.
if [ -t 1 ]; then
  solid="$(printf '\033[0;1m██')" shadow="$(printf '\033[0;2m██')" reset="$(printf '\033[0m')"
  printf '\n'
  sed -e "s/#/${solid}/g" -e "s/+/${shadow}/g" -e "s/\./${reset}  /g" -e "s/\$/${reset}/" <<'LOGO'
####.####.#..#.###.####.#...#.####.####
#..#.#....#++#.+#+.#....#+#+#.#....#..#
###..###..#++#.+#+.###..#+#+#.###..###.
#++#.#+++.#++#.+#+.#+++.#+#+#.#+++.#++#
#++#.####..##..###.####..#.#..####.#++#
LOGO
  printf '\n\033[1mReviewer %s\033[0m is installed. Run \033[1mreviewer\033[0m in a repository.\n\n' "$version"
else
  say "Reviewer ${version} is installed. Run \`reviewer\` in a repository."
fi

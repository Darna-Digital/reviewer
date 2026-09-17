#!/usr/bin/env swift

// Renders assets/reviewer-icon-{dark,light}.svg into the dock/window PNGs the
// running app paints (see src/main.ts).
//
// The SVGs are full-bleed brand tiles; macOS puts an app icon on a 1024px
// canvas as an 824px tile with a continuous ("squircle") corner, so each is
// rasterised at the tile size, clipped by a CALayer whose `cornerCurve` is the
// system's own, and centred on the canvas. The radius is the one whose
// silhouette matches, pixel for pixel, what macOS 26 draws for the packaged
// icon compiled from assets/Reviewer.icon — a circular corner of the same
// nominal radius is visibly tighter.
//
//   swift packages/desktop/scripts/render-dock-icons.swift
//
// Needs `rsvg-convert` (brew install librsvg) to rasterise the SVG.

import AppKit
import QuartzCore

let canvas = 1024
let tile: CGFloat = 824
let cornerRadius: CGFloat = 214

let assets = URL(fileURLWithPath: #filePath)
  .deletingLastPathComponent()
  .deletingLastPathComponent()
  .appendingPathComponent("assets")

func rasterize(_ svg: URL) -> CGImage {
  let png = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent("\(svg.deletingPathExtension().lastPathComponent)-\(Int(tile)).png")
  let process = Process()
  process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
  process.arguments = [
    "rsvg-convert", "-w", "\(Int(tile))", "-h", "\(Int(tile))",
    svg.path, "-o", png.path,
  ]
  try! process.run()
  process.waitUntilExit()
  guard process.terminationStatus == 0,
    let data = try? Data(contentsOf: png),
    let source = CGImageSourceCreateWithData(data as CFData, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else { fatalError("could not rasterise \(svg.lastPathComponent)") }
  return image
}

func context(_ side: Int) -> CGContext {
  guard
    let context = CGContext(
      data: nil, width: side, height: side, bitsPerComponent: 8, bytesPerRow: 0,
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
  else { fatalError("could not allocate a \(side)px context") }
  return context
}

func clipped(_ image: CGImage) -> CGImage {
  let layer = CALayer()
  layer.bounds = CGRect(x: 0, y: 0, width: tile, height: tile)
  layer.position = CGPoint(x: tile / 2, y: tile / 2)
  layer.contents = image
  layer.contentsGravity = .resize
  layer.cornerRadius = cornerRadius
  layer.cornerCurve = .continuous
  layer.masksToBounds = true

  let context = context(Int(tile))
  layer.render(in: context)
  guard let clipped = context.makeImage() else { fatalError("could not clip the tile") }
  return clipped
}

func write(_ image: CGImage, to url: URL) {
  let context = context(canvas)
  let inset = (CGFloat(canvas) - tile) / 2
  context.draw(image, in: CGRect(x: inset, y: inset, width: tile, height: tile))
  guard let composed = context.makeImage(),
    let png = NSBitmapImageRep(cgImage: composed).representation(using: .png, properties: [:])
  else { fatalError("could not encode \(url.lastPathComponent)") }
  try! png.write(to: url)
  print("wrote \(url.lastPathComponent)")
}

for appearance in ["dark", "light"] {
  let svg = assets.appendingPathComponent("reviewer-icon-\(appearance).svg")
  write(clipped(rasterize(svg)), to: assets.appendingPathComponent("reviewer-icon-\(appearance).png"))
}

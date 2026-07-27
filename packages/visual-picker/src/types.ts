export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Viewport {
  width: number
  height: number
}

export interface PickedElement {
  selector: string
  label: string
  tagName: string
  elementText: string
  elementHtml: string
  rect: Rect
  sourceFile?: string
  sourceLine?: number
}

export interface VisualComment {
  id: string
  body: string
  author: string
  createdAt: string
  pageUrl: string
  pageTitle: string
  route: string
  selector: string
  label: string
  tagName: string
  elementText: string
  elementHtml: string
  rect: Rect
  viewport: Viewport
  sourceFile?: string
  sourceLine?: number
}

export type NewVisualComment = Omit<
  VisualComment,
  "id" | "createdAt" | "author"
>

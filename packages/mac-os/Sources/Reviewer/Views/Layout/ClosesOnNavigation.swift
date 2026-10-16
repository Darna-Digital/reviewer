// A popover belongs to the page it was opened on. A click elsewhere puts
// it away on its own, but a move made from the keys or the menu bar — a
// rail shortcut, ⌘T, a window tab — leaves it standing over a page it no
// longer speaks for, still anchored to a sidebar that has faded out. So
// once the window is on another page, the popover is closed.
import SwiftUI

extension View {
    func closesOnNavigation(_ isPresented: Binding<Bool>) -> some View {
        modifier(ClosesOnNavigation(isPresented: isPresented))
    }
}

private struct ClosesOnNavigation: ViewModifier {
    @Binding var isPresented: Bool
    @Environment(AppModel.self) private var model

    func body(content: Content) -> some View {
        content.onChange(of: model.pagePath) { _, _ in isPresented = false }
    }
}

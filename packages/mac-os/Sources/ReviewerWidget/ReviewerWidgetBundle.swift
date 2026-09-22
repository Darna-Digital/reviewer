// The widget extension's entry: the one bundle WidgetKit asks for its
// widgets — the Projects widget twice over, on the recents and on the
// favourites. Built as an executable of its own and wrapped as
// ReviewerWidget.appex inside Reviewer.app by `scripts/bundle.sh`; the
// system runs it in a sandboxed process of its own, so everything it
// shows comes through the app group's feed (see `ProjectFeed`) and
// everything it does goes out through a URL (see `ProjectLink`).
//
// Two widgets rather than one with a setting: a configurable widget's
// setting is an App Intent, and its parameters only reach the widget's
// back through the metadata Xcode's build extracts — which SwiftPM does
// not. The gallery lists both, and either can stand anywhere.
import SwiftUI
import WidgetKit

@main
struct ReviewerWidgetBundle: WidgetBundle {
    var body: some Widget {
        RecentProjectsWidget()
        FavoriteProjectsWidget()
    }
}

/**
 * PageStack (WEB seam) - the portrait overlay layer's host, VERBATIM as PortraitShell.shared carried it.
 *
 * This file is a MOVE, not a rewrite, and it is meant to stay one. Web presents details as the pull-up
 * sheet (`detailPresentationPlatform` -> DETAILS_ARE_FULL_PAGE false), so this layer only ever holds the
 * handful of table-"full" kinds - one at a time, with nothing beneath to reveal and no edge-swipe
 * vocabulary on a desktop pointer. There is no page stack here to animate, so the correct web change was
 * none: same two-box padding structure (so the overlay inset and the keyboard inset still SUM as nested
 * boxes rather than overriding each other), same `hasDetailHeader` gate, same `dismissGesture={false}`,
 * same ScrollHostProvider, same BodyTransition.
 *
 * `entries`/`layerKeys` are accepted and ignored: they are PageStack.native's inputs, and the seam splits
 * on the file extension rather than on a runtime flag so the web bundle never pulls in reanimated or
 * react-native-gesture-handler.
 */
import React, { useMemo } from "react"
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native"
import { BodyTransition } from "./BodyTransition"
import type { PageStackProps } from "./PageStack.types"
import { ScrollHostProvider } from "./ScrollHost"
import { DetailHeader, hasDetailHeader } from "./SheetHeader.shared"

export function PageStack({
  bodyMounted,
  direction,
  entry,
  insets,
  keyboardAvoidance,
  renderBody,
  scrollHost,
  stack,
  transitionKey,
  view,
  webKeyboardInset,
}: PageStackProps) {
  // The overlay body was memoized on exactly these four inputs before this seam existed, and it stays
  // memoized here: PortraitShellFrame re-renders on every keyboard inset change, tab-bar measurement and
  // sheet presence flip, and rebuilding the element on each would re-render the whole page tree.
  const body = useMemo(
    () => (bodyMounted ? renderBody(entry, view) : null),
    [bodyMounted, entry, renderBody, view],
  )
  return (
    <View style={[styles.host, insets]}>
      <KeyboardAvoidingView
        style={[styles.hostContent, webKeyboardInset]}
        behavior={keyboardAvoidance && Platform.OS === "ios" ? "padding" : undefined}
        enabled={keyboardAvoidance}
      >
        {/* THE SHELL-LEVEL PAGE HEADER. It is what lets a "scroll" body become a full page with NO edit
            of its own: the sheet gave it a DetailBar (title + leading chip) from CompactShell, and the
            overlay layer used to give it nothing at all - a page with no title and, worse, no way off.
            Same component, same i18n key, same ONE affordance gate, only `dismissGesture` differs (a
            page has no grab handle to drag, so the chip may never be traded away for one).
            The bodies that own their header return the " " sentinel and render nothing here - which is
            why the HOST is gated on `hasDetailHeader` too: an empty padded wrapper would open a phantom
            12pt gap above every one of them. */}
        {bodyMounted && hasDetailHeader(entry) ? (
          <View style={styles.header}>
            <DetailHeader active={entry} stack={stack} dismissGesture={false} />
          </View>
        ) : null}
        <ScrollHostProvider value={scrollHost}>
          <BodyTransition transitionKey={transitionKey} direction={direction}>
            {body}
          </BodyTransition>
        </ScrollHostProvider>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  // The padded outer box. It was the shell's own overlay <View> (an absolute fill carrying
  // `overlayInsets`); as a flex:1 child of that same absolute fill it describes the identical rect, and
  // keeping it SEPARATE from the KeyboardAvoidingView below is what preserves the nesting the web
  // keyboard reserve depends on - `paddingBottom: safeArea` and `paddingBottom: keyboardInset` on one
  // node would override, on two they add.
  host: { flex: 1 },
  hostContent: { flex: 1 },
  // The page header's host. Its geometry is CompactShell.native's `headerHost` + `headerVPad` at a
  // non-peeked snap (paddingHorizontal 14, paddingTop 0, paddingBottom 12), so the bar a body wears as a
  // page reads the same as the bar it wore in the sheet. `flexShrink: 0` so a tall body cannot squeeze it.
  header: {
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
})

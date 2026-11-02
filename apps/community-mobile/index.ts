// The notification task must be defined before expo-router loads: a push that wakes the app headless runs
// only this bundle's entry, and expo-router requires route modules (app/_layout.tsx) only when it renders.
import "./src/push/clearTask"
import "expo-router/entry"

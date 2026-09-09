import { test } from "node:test"
import assert from "node:assert/strict"
import {
  isForeignIdentity,
  isFocused,
  isSignOutTransition,
  shouldRevalidateOnState,
} from "./authLifecycle.ts"

test("only a real BACKGROUND unfocuses the query cache", () => {
  assert.equal(isFocused("active"), true)
  assert.equal(isFocused("background"), false)
})

test("a transient 'inactive' stays focused - it must not pause in-flight retries", () => {
  assert.equal(isFocused("inactive"), true)
})

test("an unknown or absent app state is treated as focused, never as backgrounded", () => {
  assert.equal(isFocused("unknown"), true)
  assert.equal(isFocused("extension"), true)
  assert.equal(isFocused(null), true)
  assert.equal(isFocused(undefined), true)
})

test("session revalidation runs ONLY on a true foreground, not on every state change", () => {
  assert.equal(shouldRevalidateOnState("active"), true)
  assert.equal(shouldRevalidateOnState("inactive"), false)
  assert.equal(shouldRevalidateOnState("background"), false)
  assert.equal(shouldRevalidateOnState("unknown"), false)
  assert.equal(shouldRevalidateOnState(null), false)
})

test("the nav/router reset fires on authed -> unauthed and on nothing else", () => {
  assert.equal(isSignOutTransition("authed", "unauthed"), true)
})

test("boot and hydration transitions are NOT sign-outs - they must not dismiss the stack", () => {
  assert.equal(isSignOutTransition("idle", "unauthed"), false)
  assert.equal(isSignOutTransition("loading", "unauthed"), false)
  assert.equal(isSignOutTransition("idle", "authed"), false)
  assert.equal(isSignOutTransition("unauthed", "authed"), false)
  assert.equal(isSignOutTransition("authed", "authed"), false)
  assert.equal(isSignOutTransition("unauthed", "unauthed"), false)
})

test("a session that expired and came back on the SAME account is not a foreign identity", () => {
  assert.equal(isForeignIdentity("user-a", "user-a"), false)
})

test("a different account taking over the device IS a foreign identity", () => {
  assert.equal(isForeignIdentity("user-a", "user-b"), true)
})

test("a device with no remembered identity has nothing foreign to drop", () => {
  assert.equal(isForeignIdentity(null, "user-b"), false)
})

//go:build !darwin

package main

// Windows／Linux 沒有 macOS 的 App 選單與 Edit 選單，選單本來就只有「說明」，不需要額外整理。
func prepareNativeMenu() {}

func trimNativeMenu() {}

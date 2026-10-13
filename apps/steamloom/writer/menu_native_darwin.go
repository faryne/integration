//go:build darwin

package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa
#import <Cocoa/Cocoa.h>

// 系統自動加進 Edit 選單的「開始聽寫」「表情與符號」：AppKit 打開選單時才會讀這兩個偏好決定要不要加，
// 啟動時用 registration domain 設定（只在這次執行有效，不寫進使用者的偏好檔）。
static void disableSystemEditMenuItems(void) {
	[[NSUserDefaults standardUserDefaults] registerDefaults:@{
		@"NSDisabledDictationMenuItem": @YES,
		@"NSDisabledCharacterPaletteMenuItem": @YES,
	}];
}

static int logEditMenu = 0;

// Edit 選單只保留到「全選」（Wails 內建 Edit 的最後一個標準項目）。之後的東西都拿掉：Wails 附帶的 Speech，
// 以及 macOS 每次打開選單前才塞進來的 Writing Tools、AutoFill（action 都是通用的 submenuAction:、標題又跟著系統語言變，
// 只能用位置辨識）。系統每次打開都會重新加，所以掛在選單 delegate 上每次都清。
@interface WriterEditMenuTrimmer : NSObject <NSMenuDelegate>
@end

@implementation WriterEditMenuTrimmer
- (void)trim:(NSMenu *)menu {
	NSInteger selectAll = [menu indexOfItemWithTarget:nil andAction:@selector(selectAll:)];
	if (selectAll < 0) {
		for (NSInteger i = 0; i < menu.numberOfItems; i++) {
			if ([menu itemAtIndex:i].action == @selector(selectAll:)) selectAll = i;
		}
	}
	if (selectAll < 0) return;
	while (menu.numberOfItems > selectAll + 1) [menu removeItemAtIndex:menu.numberOfItems - 1];
	// 開發版：印出清理後的內容，確認沒有殘留
	if (logEditMenu) {
		for (NSMenuItem *item in [menu itemArray]) {
			NSLog(@"[edit-menu] title=%@ action=%@", item.title, item.action ? NSStringFromSelector(item.action) : @"-");
		}
	}
}
- (void)menuNeedsUpdate:(NSMenu *)menu { [self trim:menu]; }
- (void)menuWillOpen:(NSMenu *)menu { [self trim:menu]; }
@end

static WriterEditMenuTrimmer *editMenuTrimmer = nil;

// 主選單建好後在主執行緒上找出 Edit 選單（有「全選」的那個）掛上 delegate，並先清一次。
static void trimEditMenu(int logItems) {
	logEditMenu = logItems;
	dispatch_async(dispatch_get_main_queue(), ^{
		if (!editMenuTrimmer) editMenuTrimmer = [WriterEditMenuTrimmer new];
		for (NSMenuItem *top in [[NSApp mainMenu] itemArray]) {
			NSMenu *menu = [top submenu];
			if (!menu) continue;
			for (NSMenuItem *item in [menu itemArray]) {
				if (item.action == @selector(selectAll:)) {
					menu.delegate = editMenuTrimmer;
					[editMenuTrimmer trim:menu];
					break;
				}
			}
		}
	});
}
*/
import "C"

// prepareNativeMenu 在 wails.Run 之前呼叫：系統偏好要在選單第一次打開前設定。
func prepareNativeMenu() { C.disableSystemEditMenuItems() }

// trimNativeMenu 在畫面載入後呼叫（主選單已建好）。開發版另外記錄清理後的 Edit 選單內容。
func trimNativeMenu() {
	logItems := C.int(0)
	if version == "dev" {
		logItems = 1
	}
	C.trimEditMenu(logItems)
}

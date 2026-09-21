package storyteller

// ============================================================================
// 帳號配額常數——所有跟「省資源、之後做付費方案分層」有關的帳號層級用量上限
// 都集中放在這個檔案。要調整免費額度，或之後加付費方案的額度，都從這裡改，
// 不要把類似的數字散落到別的檔案裡（單次請求層級的限制，例如單張圖片大小、
// 一次最多上傳幾個檔案，維持放在各自的檔案，那些不是帳號配額，是規格限制）。
//
// 命名用 Free 前綴，不是現在就要做多方案分層——目前只有一種帳號類型——而是
// 先把命名空間留好：之後如果真的要做付費方案，加一組 ProXxx 常數就好，不用
// 回頭把 Free 前綴拿掉、到處改名。
// ============================================================================

const (
	// FreeMaxProjects 是免費帳號能建立的專案數量上限。CreateProject 會在建立
	// 前檢查目前的專案數，達到上限就擋下來。
	FreeMaxProjects = 3

	// FreeMaxProjectAssetCount 是「每個專案」底下能上傳的資產（Asset）數量
	// 上限。跟 FreeMaxProjectStorageBytes 是同一組保護：光看容量沒辦法擋
	// 「上傳一堆很小的檔案」這種情況，兩個一起檢查。
	FreeMaxProjectAssetCount = 100

	// FreeMaxProjectStorageBytes 是「每個專案」底下所有 Asset 檔案大小加總
	// 的上限，直接用 storyteller_assets.file_size 加總，不用另外量測。
	//
	// 這裡刻意只做「每專案」上限，不做「帳號總量」——帳號實際上限是
	// FreeMaxProjects * FreeMaxProjectStorageBytes 這兩個常數相乘出來的結果，
	// 不需要另外再查一次「這個使用者全部專案的 asset 加總」。
	FreeMaxProjectStorageBytes = 100 * 1024 * 1024 // 100 MB

	// ------------------------------------------------------------------
	// 以下是已經規劃、但這一輪刻意不啟用的額度——先把常數跟設計意圖留在這裡，
	// 之後真的要做的時候直接找這個檔案接上邏輯即可，不用重新設計放哪裡。
	// 目前沒有任何程式碼讀取這兩個常數。
	// ------------------------------------------------------------------

	// FreeVersionHistoryRetentionDays 免費帳號的 Story／Lore 版本歷史只保留
	// 最近幾天，尚未啟用（目前所有帳號的版本歷史都是無限期保留，沒有任何清除
	// 機制）。啟用時需要一支排程去刪除或封存超過保留期的 StoryVersion／
	// LoreVersion，這裡只先訂數字卡位，還沒有對應的清除邏輯。
	FreeVersionHistoryRetentionDays = 30

	// FreeMCPRateLimitPerMinute 免費帳號透過 MCP tool 呼叫的每分鐘次數上限，
	// 尚未啟用（目前 MCP 呼叫完全沒有 rate limit）。啟用時需要在
	// controller/storytellermcp 或更底層的 middleware 加一層計數器（例如
	// Redis token bucket），這裡只先訂數字卡位。
	FreeMCPRateLimitPerMinute = 5
)

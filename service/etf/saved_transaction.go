package etf

import (
	"faryne.dev/model/entity/opendata/etf"
	"faryne.dev/repository"
	etfRepo "faryne.dev/repository/etf"
)

// GetSavedTransactions 查無資料時回傳空陣列而非錯誤，讓前端不用特別處理 404。
func GetSavedTransactions(userID uint64, code string) (etf.ProfitTransactions, error) {
	row, err := etfRepo.NewETFSavedTransaction().Find(userID, code)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return etf.ProfitTransactions{}, nil
		}
		return nil, err
	}
	if row.DeletedAt != nil {
		return etf.ProfitTransactions{}, nil
	}
	return normalizeSells(row.Records), nil
}

// normalizeSells 補上舊格式（改成 sells 陣列之前）存下的紀錄缺少的 Sells 欄位。
// Go 的 nil slice marshal 成 JSON 會變成 null 而不是 []，前端拿到 null 呼叫
// .filter/.map 會直接炸掉，所以在這裡統一補成空陣列，不讓舊資料進到前端。
func normalizeSells(records etf.ProfitTransactions) etf.ProfitTransactions {
	for i := range records {
		if records[i].Sells == nil {
			records[i].Sells = []etf.ProfitSellEvent{}
		}
	}
	return records
}

// SaveTransactions 整包覆蓋既有紀錄；一個 (user_id, code) 只有一列。
func SaveTransactions(userID uint64, code string, records etf.ProfitTransactions) (*etf.SavedTransaction, error) {
	repo := etfRepo.NewETFSavedTransaction()
	row, err := repo.Find(userID, code)
	if err == nil {
		row.Records = records
		row.DeletedAt = nil
		if err := repo.Save(row); err != nil {
			return nil, err
		}
		return row, nil
	}
	if !repository.IsRecordNotFound(err) {
		return nil, err
	}
	newRow := &etf.SavedTransaction{UserID: userID, Code: code, Records: records}
	if err := repo.Create(newRow); err != nil {
		return nil, err
	}
	return newRow, nil
}

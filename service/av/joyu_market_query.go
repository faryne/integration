package av

import (
	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
)

// MarketStocks 股市總覽：上市中的全部（約 500 檔，不分頁，排序與篩選交給前端），附女優照片
func MarketStocks() ([]avEntity.MarketStock, error) {
	rows, err := avRepo.NewJoyuStock().ListListed()
	if err != nil {
		return nil, err
	}
	return marketStocksWithPhotos(rows)
}

// MarketStock 個股頁（含已下市的）；代碼格式不對或找不到都回 gorm.ErrRecordNotFound（404）
func MarketStock(code string) (*avEntity.MarketStock, error) {
	row, err := avRepo.NewJoyuStock().FindByID(avEntity.StockIDFromCode(code))
	if err != nil {
		return nil, err
	}
	out, err := marketStocksWithPhotos([]avEntity.JoyuStock{*row})
	if err != nil {
		return nil, err
	}
	return &out[0], nil
}

// marketStocksWithPhotos 從 dmm_actresses 補上照片（一次 IN 查完），價格從分換成單位
func marketStocksWithPhotos(rows []avEntity.JoyuStock) ([]avEntity.MarketStock, error) {
	keys := make([]avRepo.ActressKey, len(rows))
	for i, s := range rows {
		keys[i] = avRepo.ActressKey{Domain: s.Domain, ID: s.AID}
	}
	actresses, err := avRepo.NewDMMActress().FindByKeys(keys)
	if err != nil {
		return nil, err
	}
	photos := make(map[avRepo.ActressKey]string, len(actresses))
	for _, a := range actresses {
		photos[avRepo.ActressKey{Domain: a.Domain, ID: a.ID}] = actressRowFields(a).Photo
	}
	out := make([]avEntity.MarketStock, len(rows))
	for i, s := range rows {
		out[i] = avEntity.MarketStock{
			Code: avEntity.StockCode(s.ID), Domain: s.Domain, AID: s.AID, Name: s.Name, Status: s.Status,
			Photo: photos[keys[i]], Price: centsToUnits(s.LastPrice), PrevClose: centsToUnits(s.PrevClose),
			SharesOut: s.SharesOut, Videos90d: s.Videos90d, ListedAt: s.ListedAt,
		}
	}
	return out, nil
}

// centsToUnits 分換成單位（API 顯示用）
func centsToUnits(cents int64) float64 {
	return float64(cents) / 100
}

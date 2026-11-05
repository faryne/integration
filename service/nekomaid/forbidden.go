package nekomaid

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	nekomaidRepo "faryne.dev/repository/nekomaid"
	authService "faryne.dev/service/auth"
	"gorm.io/gorm"
)

// ErrForbiddenInvalid 禁抓新增的欄位不合法或目標重複；Error() 是給管理員看的中文原因
var ErrForbiddenInvalid = errors.New("invalid artwork forbidden request")

// errAlreadyForbidden 目標已經被禁（含整個畫師已被禁）；申告核准時視為已完成，不算失敗
var errAlreadyForbidden = errors.New("artwork forbidden target already exists")

type forbiddenInvalidError struct {
	reason string
	exists bool // 是否為「已經被禁」這種情況
}

func (e forbiddenInvalidError) Error() string { return e.reason }
func (e forbiddenInvalidError) Is(target error) bool {
	return target == ErrForbiddenInvalid || e.exists && target == errAlreadyForbidden
}

func invalidForbidden(format string, args ...any) error {
	return forbiddenInvalidError{reason: fmt.Sprintf(format, args...)}
}

func alreadyForbidden(format string, args ...any) error {
	return forbiddenInvalidError{reason: fmt.Sprintf(format, args...), exists: true}
}

// 畫師／作品 ID：pixiv、nico 是數字，tinami 作品帶 ti 前綴；欄位長度上限 15
var forbiddenIDPattern = regexp.MustCompile(`^[0-9A-Za-z_-]{1,15}$`)

// SearchForbidden 後台禁抓名單列表
func SearchForbidden(userID uint64, input nekomaid.ForbiddenSearchRequest) ([]nekomaid.ForbiddenAdminItem, int64, error) {
	if err := authService.RequireAdmin(userID); err != nil {
		return nil, 0, err
	}
	return nekomaidRepo.NewForbiddenRepository().Search(input)
}

// CreateForbidden 後台新增禁抓（整個畫師或單一作品）；寫入後由同步 job 把已抓的作品從 ES 拉掉
func CreateForbidden(userID uint64, req nekomaid.ForbiddenCreateRequest) (*nekomaid.ArtworkForbidden, error) {
	if err := authService.RequireAdmin(userID); err != nil {
		return nil, err
	}
	site, authorID, artworkID, err := normalizeForbiddenTarget(req.Site, req.AuthorId, req.ArtworkId)
	if err != nil {
		return nil, err
	}
	if authorID == "" {
		if authorID, err = nekomaidRepo.NewForbiddenRepository().AuthorOfArtwork(site, artworkID); errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, invalidForbidden("站內找不到作品 %s，請一併填寫畫師 ID", artworkID)
		} else if err != nil {
			return nil, err
		}
	}
	return addForbidden(nekomaid.ArtworkForbidden{
		Site: site, AuthorId: authorID, ArtworkId: artworkID,
		Source: nekomaid.ForbiddenSourceAdmin, Note: strings.TrimSpace(req.Note), CreatedBy: &userID,
	})
}

// addForbidden 新增一列禁抓（後台新增與申告核准共用）；曾經解除過的同一目標直接復原那一列，不另外新增（unique key 不會撞）。
// 目標已在名單、或整個畫師已被禁時回 alreadyForbidden 錯誤（同時也是 ErrForbiddenInvalid）。
func addForbidden(target nekomaid.ArtworkForbidden) (*nekomaid.ArtworkForbidden, error) {
	repo := nekomaidRepo.NewForbiddenRepository()
	if target.ArtworkId != "" {
		if blocked, err := repo.IsForbidden(target.Site, target.AuthorId, ""); err != nil {
			return nil, err
		} else if blocked {
			return nil, alreadyForbidden("畫師 %s 已整個列入禁抓，不用再單獨禁這件作品", target.AuthorId)
		}
	}

	row, err := repo.FindTarget(target.Site, target.AuthorId, target.ArtworkId)
	switch {
	case err == nil && !row.IsDeleted:
		return nil, alreadyForbidden("這個目標已經在禁抓名單裡")
	case err != nil && !errors.Is(err, gorm.ErrRecordNotFound):
		return nil, err
	case err == nil: // 復原：沿用原本的 id 與建立時間
		target.Id, target.CreatedAt = row.Id, row.CreatedAt
	}
	// 新增與復原一律重設為待同步，由同步 job 把作品從 ES 拉掉
	target.IsProceed, target.FinishTime, target.IsDeleted, target.DeletedAt = false, nil, false, nil
	if err := repo.Save(&target); err != nil {
		return nil, err
	}
	return &target, nil
}

// DeleteForbidden 解除禁抓（soft delete）；由同步 job 把 artwork_main 的作品重新索引回 ES
func DeleteForbidden(userID, id uint64) error {
	if err := authService.RequireAdmin(userID); err != nil {
		return err
	}
	return nekomaidRepo.NewForbiddenRepository().SoftDelete(id)
}

// normalizeForbiddenTarget 驗證並整理站台與 ID；tinami 作品 ID 補 ti 前綴（跟作品頁的規則一致）
func normalizeForbiddenTarget(siteValue, authorID, artworkID string) (enum.NekomaidSite, string, string, error) {
	site := enum.NekomaidSite(strings.ToLower(strings.TrimSpace(siteValue)))
	authorID, artworkID = strings.TrimSpace(authorID), strings.TrimSpace(artworkID)
	switch site {
	case enum.NekomaidSitePixiv, enum.NekomaidSiteNico, enum.NekomaidSiteTinami:
	default:
		return "", "", "", invalidForbidden("不支援的來源站：%s", siteValue)
	}
	if authorID == "" && artworkID == "" {
		return "", "", "", invalidForbidden("畫師 ID 與作品 ID 至少要填一個")
	}
	if site == enum.NekomaidSiteTinami && artworkID != "" && !strings.HasPrefix(artworkID, "ti") {
		artworkID = "ti" + artworkID
	}
	for _, id := range []string{authorID, artworkID} {
		if id != "" && !forbiddenIDPattern.MatchString(id) {
			return "", "", "", invalidForbidden("ID 格式不正確：%s", id)
		}
	}
	return site, authorID, artworkID, nil
}

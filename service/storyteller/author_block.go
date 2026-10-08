package storyteller

import (
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// 作者封鎖：以「貼文的身份」封鎖留言者的帳號。在筆名 P 封鎖的人，在本人貼文底下照樣能留言；
// 若封鎖對整個帳號生效，被封鎖者去另一個身份一試就知道兩者是同一人。
// 被封鎖者仍可閱讀與按讚，只是不能在該身份的動態（以及之後的討論區）留言。

// BlockCommenter 從留言旁的「封鎖」按鈕進來：封鎖者身份＝留言所在貼文的身份，前端不傳身份。
func (s *Service) BlockCommenter(viewerID uint64, commentPublicID string) error {
	comment, post, err := s.commentWithPost(commentPublicID)
	if err != nil {
		return err
	}
	if post.UserID != viewerID {
		return ErrAuthorPostForbidden
	}
	if comment.UserID == viewerID {
		return ErrCannotBlockSelf
	}
	return s.repo.UpsertAuthorBlock(&storytellerModel.AuthorBlock{
		PublicID: randomID(), UserID: post.UserID, ProfileID: post.ProfileID, BlockedUserID: comment.UserID,
	})
}

// myIdentityKey 把封鎖名單的 ?as= 轉成自己的身份：空白是本人，否則必須是自己的筆名。
func (s *Service) myIdentityKey(viewerID uint64, as string) (storytellerModel.AuthorIdentityKey, error) {
	as = strings.TrimSpace(as)
	if as == "" {
		return storytellerModel.AuthorIdentityKey{UserID: viewerID}, nil
	}
	identity, err := s.ownedIdentity(viewerID, as)
	if err != nil {
		return storytellerModel.AuthorIdentityKey{}, err
	}
	return storytellerModel.AuthorIdentityKey{UserID: identity.UserID, ProfileID: identity.ProfileID}, nil
}

// AuthorBlocks 是工作台的封鎖名單；被封鎖者顯示本人身份（v1 只能以本人身份在別人的動態留言）。
func (s *Service) AuthorBlocks(viewerID uint64, as string) ([]storytellerModel.AuthorBlockOutput, error) {
	key, err := s.myIdentityKey(viewerID, as)
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.AuthorBlocks(key.UserID, key.ProfileID)
	if err != nil {
		return nil, err
	}
	keys := make([]storytellerModel.AuthorIdentityKey, 0, len(rows))
	for _, row := range rows {
		keys = append(keys, storytellerModel.AuthorIdentityKey{UserID: row.BlockedUserID})
	}
	book, err := loadIdentityBook(s.repo, keys)
	if err != nil {
		return nil, err
	}
	outputs := make([]storytellerModel.AuthorBlockOutput, 0, len(rows))
	for _, row := range rows {
		blocked, ok := book.lookup(storytellerModel.AuthorIdentityKey{UserID: row.BlockedUserID})
		if !ok {
			blocked = storytellerModel.AuthorIdentityOutput{PenName: anonymousReaderName}
		}
		outputs = append(outputs, storytellerModel.AuthorBlockOutput{PublicID: row.PublicID, Blocked: blocked, CreatedAt: row.CreatedAt})
	}
	return outputs, nil
}

func (s *Service) DeleteAuthorBlock(viewerID uint64, blockPublicID string) error {
	row, err := s.repo.AuthorBlockByPublicIDForUser(viewerID, blockPublicID)
	if err != nil {
		return err
	}
	return s.repo.SoftDeleteAuthorBlock(row.ID)
}

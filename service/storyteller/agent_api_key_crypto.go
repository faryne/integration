package storyteller

import (
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/crypto"
)

// Provider API key 的加解密只是把 crypto.Envelope 對應到 ProviderAPIKey 的三個欄位；
// envelope encryption 與 master key 管理本身在 service/crypto（OAuth access token 也共用）。

func decryptProviderAPIKey(key *storytellerModel.ProviderAPIKey) (string, error) {
	plaintext, err := crypto.OpenWithMasterKey(crypto.Envelope{
		Ciphertext: key.APIKeyEncrypted, DataKey: key.APIKeyDataKey, KeyID: key.APIKeyKeyID,
	})
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(plaintext), nil
}

func applyEncryptedProviderAPIKey(key *storytellerModel.ProviderAPIKey, plaintext string) error {
	encrypted, err := crypto.SealWithMasterKey(strings.TrimSpace(plaintext))
	if err != nil {
		return err
	}
	key.APIKeyEncrypted, key.APIKeyDataKey, key.APIKeyKeyID = encrypted.Ciphertext, encrypted.DataKey, encrypted.KeyID
	return nil
}

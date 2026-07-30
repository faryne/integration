package storyteller

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"faryne.dev/config"
)

// 比照 service/nekomaid/cloudfront.go 的簽名邏輯，但讀取獨立的
// StorytellerCloudFrontKeyPairID／StorytellerCloudFrontPrivateKeyFile 設定，
// 不跟 nekomaid 共用私鑰。刻意不抽成共用套件——nekomaid 自己的簽名邏輯也是各自
// 一份放在自己的 package 裡，這裡跟隨既有慣例。

const (
	imageCloudFrontSignatureTTL     = time.Hour
	imageCloudFrontSignatureRefresh = 5 * time.Minute
)

type cachedImageSignedURL struct {
	url       string
	expiresAt time.Time
}

type imageCloudFrontURLSigner struct {
	mu         sync.Mutex
	privateKey *rsa.PrivateKey
	cache      map[string]cachedImageSignedURL
	now        func() time.Time
}

var imageURLSigner = &imageCloudFrontURLSigner{
	cache: make(map[string]cachedImageSignedURL),
	now:   time.Now,
}

func (s *imageCloudFrontURLSigner) sign(resource string) (string, error) {
	resource = strings.Replace(resource, "http:", "https:", 1)
	if resource == "" {
		return "", nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	now := s.now()
	if cached, ok := s.cache[resource]; ok && now.Add(imageCloudFrontSignatureRefresh).Before(cached.expiresAt) {
		return cached.url, nil
	}

	keyPairID := config.EnvConfig().StorytellerCloudFrontKeyPairID
	if keyPairID == "" || config.EnvConfig().StorytellerCloudFrontPrivateKeyFile == "" {
		return "", fmt.Errorf("storyteller CloudFront signing configuration is incomplete")
	}
	if s.privateKey == nil {
		privateKey, err := loadImageCloudFrontPrivateKey(config.EnvConfig().StorytellerCloudFrontPrivateKeyFile)
		if err != nil {
			return "", err
		}
		s.privateKey = privateKey
	}

	expiresAt := now.Add(imageCloudFrontSignatureTTL)
	policy := fmt.Sprintf(
		`{"Statement":[{"Resource":%q,"Condition":{"DateLessThan":{"AWS:EpochTime":%d}}}]}`,
		resource,
		expiresAt.Unix(),
	)
	digest := sha1.Sum([]byte(policy))
	signature, err := rsa.SignPKCS1v15(rand.Reader, s.privateKey, crypto.SHA1, digest[:])
	if err != nil {
		return "", fmt.Errorf("sign CloudFront URL: %w", err)
	}

	query := url.Values{}
	query.Set("Signature", imageCloudFrontBase64(signature))
	query.Set("Key-Pair-Id", keyPairID)
	query.Set("Policy", imageCloudFrontBase64([]byte(policy)))
	separator := "?"
	if strings.Contains(resource, "?") {
		separator = "&"
	}
	signedURL := resource + separator + query.Encode()
	s.cache[resource] = cachedImageSignedURL{url: signedURL, expiresAt: expiresAt}
	return signedURL, nil
}

func loadImageCloudFrontPrivateKey(filename string) (*rsa.PrivateKey, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("read CloudFront private key: %w", err)
	}
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, fmt.Errorf("decode CloudFront private key: invalid PEM")
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse CloudFront private key: %w", err)
	}
	rsaKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("CloudFront private key is not RSA")
	}
	return rsaKey, nil
}

func imageCloudFrontBase64(value []byte) string {
	return strings.NewReplacer("+", "-", "=", "_", "/", "~").Replace(base64.StdEncoding.EncodeToString(value))
}

// signImageURL 把 S3 object key 組成完整 CDN 網址並簽名，讀取當下才簽（不落地存），
// 比照 service/nekomaid/artwork.go 的 signArtworkPhotos 模式。
func signImageURL(imageKey string) (string, error) {
	cdnURL := strings.TrimRight(config.EnvConfig().CDNUrl, "/")
	if cdnURL == "" {
		return "", fmt.Errorf("CDN_URL is not configured")
	}
	resource := cdnURL + "/" + strings.TrimLeft(imageKey, "/")
	return imageURLSigner.sign(resource)
}

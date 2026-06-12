package nekomaid

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

const (
	cloudFrontSignatureTTL     = time.Hour
	cloudFrontSignatureRefresh = 5 * time.Minute
)

type cachedSignedURL struct {
	url       string
	expiresAt time.Time
}

type cloudFrontURLSigner struct {
	mu         sync.Mutex
	privateKey *rsa.PrivateKey
	cache      map[string]cachedSignedURL
	now        func() time.Time
}

var artworkURLSigner = &cloudFrontURLSigner{
	cache: make(map[string]cachedSignedURL),
	now:   time.Now,
}

func (s *cloudFrontURLSigner) sign(resource string) (string, error) {
	resource = strings.Replace(resource, "http:", "https:", 1)
	if resource == "" {
		return "", nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	now := s.now()
	if cached, ok := s.cache[resource]; ok && now.Add(cloudFrontSignatureRefresh).Before(cached.expiresAt) {
		return cached.url, nil
	}

	keyPairID := config.EnvConfig().CloudFrontKeyPairID
	if keyPairID == "" || config.EnvConfig().CloudFrontPrivateKeyFile == "" {
		return "", fmt.Errorf("CloudFront signing configuration is incomplete")
	}
	if s.privateKey == nil {
		privateKey, err := loadRSAPrivateKey(config.EnvConfig().CloudFrontPrivateKeyFile)
		if err != nil {
			return "", err
		}
		s.privateKey = privateKey
	}

	expiresAt := now.Add(cloudFrontSignatureTTL)
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
	query.Set("Signature", cloudFrontBase64(signature))
	query.Set("Key-Pair-Id", keyPairID)
	query.Set("Policy", cloudFrontBase64([]byte(policy)))
	separator := "?"
	if strings.Contains(resource, "?") {
		separator = "&"
	}
	signedURL := resource + separator + query.Encode()
	s.cache[resource] = cachedSignedURL{url: signedURL, expiresAt: expiresAt}
	return signedURL, nil
}

func loadRSAPrivateKey(filename string) (*rsa.PrivateKey, error) {
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

func cloudFrontBase64(value []byte) string {
	return strings.NewReplacer("+", "-", "=", "_", "/", "~").Replace(base64.StdEncoding.EncodeToString(value))
}

package auth

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"faryne.dev/config"
	"github.com/golang-jwt/jwt/v4"
)

const firebaseCertURL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"

type FirebaseToken struct {
	UID         string
	Email       *string
	DisplayName *string
	PhotoURL    *string
	Provider    string
}

type firebaseClaims struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Picture  string `json:"picture"`
	Firebase struct {
		SignInProvider string `json:"sign_in_provider"`
	} `json:"firebase"`
	jwt.RegisteredClaims
}

type certCache struct {
	keys      map[string]*rsa.PublicKey
	expiresAt time.Time
	mu        sync.RWMutex
}

var firebaseCertCache = &certCache{}

func VerifyFirebaseIDToken(idToken string) (*FirebaseToken, error) {
	projectID := strings.TrimSpace(config.EnvConfig().FirebaseProjectID)
	if projectID == "" {
		return nil, errors.New("FIREBASE_PROJECT_ID is not configured")
	}

	claims := &firebaseClaims{}
	token, err := jwt.ParseWithClaims(idToken, claims, func(token *jwt.Token) (interface{}, error) {
		if token.Method.Alg() != jwt.SigningMethodRS256.Alg() {
			return nil, fmt.Errorf("unexpected signing method: %s", token.Method.Alg())
		}

		kid, ok := token.Header["kid"].(string)
		if !ok || kid == "" {
			return nil, errors.New("missing Firebase token kid")
		}
		return firebaseCertCache.getKey(kid)
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid Firebase ID token")
	}

	expectedIssuer := "https://securetoken.google.com/" + projectID
	if !claims.VerifyIssuer(expectedIssuer, true) {
		return nil, errors.New("invalid Firebase token issuer")
	}
	if !claims.VerifyAudience(projectID, true) {
		return nil, errors.New("invalid Firebase token audience")
	}
	if claims.Subject == "" {
		return nil, errors.New("Firebase token subject is empty")
	}
	if claims.Firebase.SignInProvider != "google.com" {
		return nil, errors.New("only Google sign-in is allowed")
	}

	return &FirebaseToken{
		UID:         claims.Subject,
		Email:       optionalString(claims.Email),
		DisplayName: optionalString(claims.Name),
		PhotoURL:    optionalString(claims.Picture),
		Provider:    claims.Firebase.SignInProvider,
	}, nil
}

func (c *certCache) getKey(kid string) (*rsa.PublicKey, error) {
	c.mu.RLock()
	if time.Now().Before(c.expiresAt) && c.keys != nil {
		if key, ok := c.keys[kid]; ok {
			c.mu.RUnlock()
			return key, nil
		}
	}
	c.mu.RUnlock()

	if err := c.refresh(); err != nil {
		return nil, err
	}

	c.mu.RLock()
	defer c.mu.RUnlock()
	key, ok := c.keys[kid]
	if !ok {
		return nil, errors.New("Firebase token kid not found")
	}
	return key, nil
}

func (c *certCache) refresh() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if time.Now().Before(c.expiresAt) && c.keys != nil {
		return nil
	}

	client := http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(firebaseCertURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("fetch Firebase certs failed: %s", resp.Status)
	}

	var raw map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return err
	}

	keys := make(map[string]*rsa.PublicKey, len(raw))
	for kid, certPEM := range raw {
		block, _ := pem.Decode([]byte(certPEM))
		if block == nil {
			return fmt.Errorf("decode Firebase cert failed for kid %s", kid)
		}
		cert, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return err
		}
		publicKey, ok := cert.PublicKey.(*rsa.PublicKey)
		if !ok {
			return fmt.Errorf("Firebase cert public key is not RSA for kid %s", kid)
		}
		keys[kid] = publicKey
	}

	maxAge := 1 * time.Hour
	cacheControl := resp.Header.Get("Cache-Control")
	for _, part := range strings.Split(cacheControl, ",") {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "max-age=") {
			if seconds, err := strconv.Atoi(strings.TrimPrefix(part, "max-age=")); err == nil && seconds > 0 {
				maxAge = time.Duration(seconds) * time.Second
			}
		}
	}

	c.keys = keys
	c.expiresAt = time.Now().Add(maxAge)
	return nil
}

func optionalString(v string) *string {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	return &v
}

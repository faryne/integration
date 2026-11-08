APP_BIN ?= ./apidev
ENV_FILE ?= ./.env
PID_FILE ?= ./apidev.pid
LOG_FILE ?= ./apidev.log
BUILD_VERSION ?= $(shell date '+%Y-%m-%d.%H%M%S')
GO_LDFLAGS := -X main.buildVersion=$(BUILD_VERSION)

build-linux:
	GOOS=linux GOARCH=amd64 go build -ldflags "$(GO_LDFLAGS)" -o apidev . && rsync -av apidev makefile ubuntu@nekomimi.maid.tw:~/server-apidev && rm apidev

build-linux-arm:
	GOOS=linux GOARCH=arm64 go build -ldflags "$(GO_LDFLAGS)" -o apidev-arm64 . && rsync -av apidev-arm64 makefile ubuntu@nekomimi.maid.tw:~/server-apidev && rm apidev-arm64

build-frontend:
	cd static_site; \
	VITE_API_BASE=https://faryne.dev/api pnpm build && \
	pnpm deploy:main && \
	cd ..

build-frontend-galgame:
	cd static_site; \
	VITE_SITE=galgame VITE_API_BASE=https://galgame.tv/api pnpm build && \
	pnpm deploy:galgame && \
	cd ..

build-frontend-nekomaid:
	cd static_site; \
	VITE_SITE=nekomaid VITE_API_BASE=https://neko.maid.tw/api pnpm build && \
	pnpm deploy:nekomaid && \
	cd ..

build-frontend-steamloom:
	cd static_site; \
	VITE_SITE=steamloom VITE_API_BASE=https://steamloom.works/api pnpm build && \
	pnpm deploy:steamloom && \
	cd ..

# 獨立站的 VITE_SITE 讓 index.html 換成該站品牌、跳過主站的 prerender（見 vite-plugins/siteBranding.ts）；joyu 另外會拔掉 AdSense
build-frontend-joyu:
	cd static_site; \
	VITE_SITE=joyu VITE_API_BASE=https://joyu.fyi/api pnpm build && \
	pnpm deploy:joyu && \
	cd ..

worker-install:
	cd workers && npm install

worker-dev:
	cd workers && npm run dev

worker-secret:
	cd workers && npx wrangler secret put PROXY_TOKEN

worker-deploy:
	cd workers && npm run deploy

mig-up:
	sql-migrate up -config ./migration/config.yml -env localhost

mig-down:
	sql-migrate down -config ./migration/config.yml -env localhost

# neko.maid.tw（artworks DB）：DSN 從 .env 的 NEKOMAID_DSN 讀；注意本機 .env 目前指向 prod
NEKOMAID_DSN_FROM_ENV = $$(grep '^NEKOMAID_DSN=' .env | cut -d= -f2- | tr -d '"')

mig-up-nekomaid:
	NEKOMAID_DSN="$(NEKOMAID_DSN_FROM_ENV)" sql-migrate up -config ./migration/nekomaid.yml -env localhost

mig-down-nekomaid:
	NEKOMAID_DSN="$(NEKOMAID_DSN_FROM_ENV)" sql-migrate down -limit=1 -config ./migration/nekomaid.yml -env localhost

mig-status-nekomaid:
	NEKOMAID_DSN="$(NEKOMAID_DSN_FROM_ENV)" sql-migrate status -config ./migration/nekomaid.yml -env localhost

start:
	@if [ -f "$(PID_FILE)" ] && kill -0 "$$(cat "$(PID_FILE)")" 2>/dev/null; then \
		echo "Already running: pid=$$(cat "$(PID_FILE)")"; \
		exit 1; \
	fi
	@nohup "$(APP_BIN)" -env "$(ENV_FILE)" >> "$(LOG_FILE)" 2>&1 & echo $$! > "$(PID_FILE)"
	@echo "Started $(APP_BIN): pid=$$(cat "$(PID_FILE)"), log=$(LOG_FILE)"

restart:
	@if [ ! -f "$(PID_FILE)" ]; then \
		echo "PID file not found: $(PID_FILE)"; \
		exit 1; \
	fi
	@kill -HUP "$$(cat "$(PID_FILE)")"
	@echo "Restart signal sent: pid=$$(cat "$(PID_FILE)")"

shutdown:
	@if [ ! -f "$(PID_FILE)" ]; then \
		echo "PID file not found: $(PID_FILE)"; \
		exit 1; \
	fi
	@kill -TERM "$$(cat "$(PID_FILE)")"
	@echo "Shutdown signal sent: pid=$$(cat "$(PID_FILE)")"

status:
	@if [ -f "$(PID_FILE)" ] && kill -0 "$$(cat "$(PID_FILE)")" 2>/dev/null; then \
		echo "Running: pid=$$(cat "$(PID_FILE)")"; \
	else \
		echo "Not running"; \
	fi

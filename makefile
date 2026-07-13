APP_BIN ?= ./apidev
ENV_FILE ?= ./.env
PID_FILE ?= ./apidev.pid
LOG_FILE ?= ./apidev.log
BUILD_VERSION ?= $(shell date '+%Y-%m-%d.%H%M%S')
GO_LDFLAGS := -X main.buildVersion=$(BUILD_VERSION)

build-linux:
	GOOS=linux GOARCH=amd64 go build -ldflags "$(GO_LDFLAGS)" -o apidev main.go && rsync -av apidev makefile ubuntu@nekomimi.maid.tw:~/server-apidev && rm apidev

build-linux-arm:
	GOOS=linux GOARCH=arm64 go build -ldflags "$(GO_LDFLAGS)" -o apidev-arm64 main.go && rsync -av apidev-arm64 makefile ubuntu@nekomimi.maid.tw:~/server-apidev && rm apidev-arm64

build-frontend:
	cd static_site; \
	VITE_API_BASE=https://faryne.dev/api-integration pnpm build && \
	pnpm deploy:main && \
	cd ..

build-frontend-galgame:
	cd static_site; \
	VITE_API_BASE=https://faryne.dev/api-integration pnpm build && \
	pnpm deploy:galgame && \
	cd ..

build-frontend-nekomaid:
	cd static_site; \
	VITE_API_BASE=https://faryne.dev/api-integration pnpm build && \
	pnpm deploy:nekomaid && \
	cd ..

build-frontend-steamloom:
	cd static_site; \
	VITE_API_BASE=https://faryne.dev/api-integration pnpm build && \
	pnpm deploy:steamloom && \
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

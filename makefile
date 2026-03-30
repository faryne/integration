build-linux:
	GOOS=linux GOARCH=amd64 go build -o apidev main.go && rsync -av apidev ubuntu@nekomimi.maid.tw:~/server-apidev

build-frontend:
	cd static_site; \
	VITE_API_BASE=https://faryne.dev/api-integration pnpm build && \
	firebase deploy --project faryne-integration && \
	cd ..
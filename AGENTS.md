# AGENTS.md

## Purpose

This file provides project-specific guidance for coding agents working in this repository.

## Project Overview

`faryne.dev` is a personal side project built primarily with Go and Fiber. The repository contains:

- a Go backend API
- database migrations
- scheduled jobs defined in `main.go`
- a frontend app under `static_site/`

## Architecture

Follow the existing module boundaries.

- `config/`: environment variables and global configuration
- `route/`: route registration and middleware wiring
- `controller/`: request parsing, validation, and HTTP handling
- `service/`: business logic
- `repository/`: data access and CRUD operations
- `model/`: entities, DTOs, and enums
- `migration/`: database migrations managed by `sql-migrate`
- `docs/`: Swagger and related documentation
- `static_site/`: frontend source

## Working Rules

- Keep business logic in `service/`.
- Keep database access in `repository/`.
- Controllers should stay thin and delegate to services.
- When adding an API, prefer this flow:
  1. define data structures in `model/`
  2. implement persistence in `repository/`
  3. add business logic in `service/`
  4. add handlers in `controller/`
  5. register routes in `route/`
- Add cron logic in the `cronjob` section of `main.go`, and keep substantial logic in `service/`.

## Technology Notes

- Use modern Go style compatible with Go 1.26+.
- The backend uses Fiber v3.
- The project uses MySQL, Redis, and Manticore Search.
- Database migrations use `sql-migrate` with environments such as `localhost`, `development`, and `master`.

## Common Commands

- `go run main.go`: run the backend locally
- `docker-compose up -d`: start local infrastructure
- `make mig-up`: apply localhost migrations
- `make mig-down`: roll back localhost migrations
- `make build-linux`: build and sync the Linux backend artifact
- `make build-frontend`: build and deploy the frontend
- `which go`: check the Go version and path

## Restricted Areas

Do not modify or rely on these directories unless the user explicitly asks for it.

- `php7-version/`: legacy PHP code kept only for manual reference during migration work
- `secret_keys/`: sensitive material that must not be exposed or reused in code changes

## Frontend Note

`static_site/README.md` is currently the default Vite template README. Treat the actual source tree in `static_site/` as authoritative over that README when making frontend changes.

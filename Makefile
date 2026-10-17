# Common project commands. The repository uses one canonical docker-compose.yml.

.PHONY: help init up up-d down build logs status validate seed-demo test frontend-test backend-test

help:
	@echo "make init          Prepare local .env and keys"
	@echo "make validate      Validate Docker Compose"
	@echo "make up            Start the full stack"
	@echo "make up-d          Start the full stack in background"
	@echo "make down          Stop containers and keep volumes"
	@echo "make seed-demo     Seed idempotent demo data"
	@echo "make frontend-test Run frontend tests and build"
	@echo "make backend-test  Run backend tests"

init:
	powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1 -Mode PrepareOnly

validate:
	docker compose config --quiet

up:
	docker compose up --build

up-d:
	docker compose up --build -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

status:
	docker compose ps -a

seed-demo:
	cd services && npm.cmd run prisma:seed:demo

frontend-test:
	cd frontend && npm.cmd run test && npm.cmd run build

backend-test:
	cd services && npm.cmd run build && npm.cmd test -- --runInBand

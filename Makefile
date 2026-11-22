.PHONY: setup up down logs check fix e2e fresh

# От клона до работающего приложения. Повторный запуск безопасен.
setup:
	test -f backend/.env || cp backend/.env.example backend/.env
	$(MAKE) up
	docker compose exec -T backend php artisan migrate
	docker compose exec -T backend php artisan db:seed
	git config core.hooksPath .githooks && echo "pre-commit хук включён: перед коммитом запускается make check"

up:
	docker compose up -d --wait

down:
	docker compose down

logs:
	docker compose logs -f backend frontend

check:
	docker compose exec -T backend composer check
	docker compose exec -T frontend npm run check

fix:
	docker compose exec -T backend vendor/bin/pint
	docker compose exec -T frontend sh -c "npm run lint && npm run format"

e2e:
	docker compose exec -T backend php artisan db:seed
	docker compose run --rm e2e

fresh:
	docker compose exec -T backend php artisan migrate:fresh --seed

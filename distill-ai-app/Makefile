.PHONY: local dev

local:
	@echo "→ Building to catch errors..."
	npm run build
	@echo "→ Starting local dev server..."
	@echo "→ App running at http://localhost:3000"
	npm run dev

dev:
	@echo "→ Building to catch errors..."
	npm run build
	@echo "→ Deploying to Vercel preview..."
	npx vercel
	@echo "→ Preview link above — open it to test on Vercel infrastructure"

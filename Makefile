.PHONY: install test build chain deploy dev image

install:
	npm install

test:
	npm test

build:
	npm run build

chain:
	npm run chain

deploy:
	npm run deploy

dev:
	npm run dev

image:
	docker build -t aether-desk:local .

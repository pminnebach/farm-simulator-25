# Farm Manager

Track fields and harvests for Farming Simulator 25.

## Local development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). SQLite data is stored in `data/farm.db`.

## Docker (local development)

```bash
docker compose up --build
```

This mounts the project for hot reload and persists the database in the `farm_data` volume.

## Docker (production image)

```bash
docker build -t farm-sim .
docker run --rm -p 3000:3000 -v farm-sim-data:/app/data farm-sim
```

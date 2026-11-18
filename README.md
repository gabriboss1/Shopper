# Shopper

Shopper builds a conflict-free Yale shopping-period week and estimates walking time between buildings from campus coordinates.

The course list is mock data so the app runs without Yale Course Search or CourseTable. Section capacity is not invented.

## Run

```bash
npm ci
npm run dev
```

Open http://localhost:3000.

Walking times use straight-line distance between building coordinates, stretched by a campus path factor, at about 1.25 m/s. There is no Mapbox or Google routing token.

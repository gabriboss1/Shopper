VIDEO: https://drive.google.com/file/d/1BK9AHq-8Y15swjkz5j3cRQgHLXIjEcYm/view?usp=sharing

# Shopper

![Grokathon proof](docs/grokathon-proof.png)

Grokathon proof

Shopper builds a conflict-free Yale shopping-period week and estimates walking time between buildings from campus coordinates.

The course list is mock data so the app runs without Yale Course Search or CourseTable. Section capacity is not invented.

## Run

```bash
npm ci
npm run dev
```

Open http://localhost:3000.

Walking times use straight-line distance between building coordinates, stretched by a campus path factor, at about 1.25 m/s. There is no Mapbox or Google routing token.

CAS pairing stores the NetID and password only as AES-GCM ciphertext. Shopper does not sign in to Yale. The encryption key is `SHOPPER_CAS_KEY` when that server variable is set, otherwise a key file under `.data/` that is not committed. Postgres is used when `DATABASE_URL` is set; local development uses in-memory PGlite.

Calendar conflicts come from events you type in. Google and Outlook are not connected. Export downloads an `.ics` file with the class time and a walking buffer. Section capacity always reads “Capacity unknown.”

A share link (`/?list=course-id,course-id`) restores a shopping list and does not include calendar events or credentials.

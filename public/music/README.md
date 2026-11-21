# Ajouter un morceau lofi

1. Place un fichier MP3 (`.mp3`) ou Ogg Vorbis (`.ogg`) que tu as le droit de diffuser dans ce dossier. Vise 2 à 5 Mo par morceau. Un MP3 à 96–128 kbit/s est un bon point de départ.
2. Dans [`src/music/playlist.ts`](../../src/music/playlist.ts), ajoute une entrée au tableau `playlist` avec le nom exact du fichier, le titre et l’artiste à afficher. Exemple à adapter à ton fichier et à ses droits.

   ```ts
   {
     file: "soir-sur-la-piste.mp3",
     title: "Soir sur la piste",
     artist: "Nom de l’artiste",
   },
   ```

3. Les morceaux passent dans l’ordre du tableau, en boucle. Tant que la liste est vide, le lecteur est masqué.

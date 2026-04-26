export const PRIVACY_DISCLOSURE = {
  de: {
    title: 'Was wir wissen',
    body: 'Stadtpuls sendet nur eine grobe 1,2-km-Zelle (Geohash), keine genaue Position. Intention-Flags (z.B. "kalt", "regnerisch") werden lokal berechnet. Kein Nutzerprofil, keine Bewegungshistorie auf dem Server.',
    what_stays: 'Auf deinem Gerät: genaue Position, Bewegungshistorie, frühere Angebote.',
    what_sent: 'An den Server: Geohash, Intention-Flags, Zeitbucket, Geräte-Hash (rotiert pro Sitzung).',
  },
  en: {
    title: 'What we know',
    body: 'Stadtpuls only sends a coarse 1.2 km cell (geohash), never your exact location. Intent flags (e.g. "cold", "rainy") are computed on-device. No user profile, no movement history on the server.',
    what_stays: 'On your device: exact location, movement history, past offers.',
    what_sent: 'To the server: geohash, intent flags, time bucket, device hash (rotated per session).',
  },
};

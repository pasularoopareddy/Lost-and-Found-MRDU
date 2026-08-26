// MRDU campus centre. These can still be overridden in backend/.env.
const CAMPUS_LATITUDE = Number(process.env.CAMPUS_LATITUDE ?? 17.5449);
const CAMPUS_LONGITUDE = Number(process.env.CAMPUS_LONGITUDE ?? 78.5718);
const CAMPUS_RADIUS_METRES = Number(process.env.CAMPUS_RADIUS_METRES ?? 1200);
const NEAR_CAMPUS_RADIUS_METRES = Number(process.env.NEAR_CAMPUS_RADIUS_METRES ?? 3500);

const radians = (degrees: number) => (degrees * Math.PI) / 180;

export const distanceInMetres = (latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) => {
  const deltaLatitude = radians(latitudeB - latitudeA);
  const deltaLongitude = radians(longitudeB - longitudeA);
  const value = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * 6_371_000 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

export const getCoverageZone = (latitude: number, longitude: number) => {
  const distance = distanceInMetres(latitude, longitude, CAMPUS_LATITUDE, CAMPUS_LONGITUDE);
  if (distance <= CAMPUS_RADIUS_METRES) return { zone: "CAMPUS", distance };
  if (distance <= NEAR_CAMPUS_RADIUS_METRES) return { zone: "NEAR_CAMPUS", distance };
  return { zone: null, distance };
};

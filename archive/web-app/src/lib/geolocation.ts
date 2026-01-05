/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Check if a user is within a certain distance of a rig
 * @param userLat User's latitude
 * @param userLon User's longitude
 * @param rigLat Rig's latitude
 * @param rigLon Rig's longitude
 * @param maxDistanceKm Maximum distance in kilometers
 * @returns true if user is within the specified distance
 */
export function isNearRig(
  userLat: number,
  userLon: number,
  rigLat: number,
  rigLon: number,
  maxDistanceKm: number = 0.1 // Default 100 meters
): boolean {
  const distance = calculateDistance(userLat, userLon, rigLat, rigLon);
  return distance <= maxDistanceKm;
}

/**
 * Format distance for display
 * @param distanceKm Distance in kilometers
 * @returns Formatted string (e.g., "50 m", "1.2 km")
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 0.1) {
    return `${Math.round(distanceKm * 1000)} m`;
  } else if (distanceKm < 1) {
    return `${(distanceKm * 1000).toFixed(0)} m`;
  } else {
    return `${distanceKm.toFixed(2)} km`;
  }
}


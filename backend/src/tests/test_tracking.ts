import { TrackingService } from '../services/trackingService.js';

async function runTrackingTests() {
  console.log('--- STARTING TRACKING GEOSPATIAL & BUSINESS LOGIC TESTS ---');

  // Test 1: Coordinate Validation
  console.log('\n[Test 1] Coordinate Validation:');
  const validCoord = TrackingService.isValidCoordinate(12.9716, 77.5946);
  const invalidLat = TrackingService.isValidCoordinate(95.0, 77.5946);
  const invalidLng = TrackingService.isValidCoordinate(12.9716, -190.0);
  console.log(`  - Bangalore coords (12.9716, 77.5946) valid: ${validCoord} (Expected: true)`);
  console.log(`  - Latitude 95.0 valid: ${invalidLat} (Expected: false)`);
  console.log(`  - Longitude -190.0 valid: ${invalidLng} (Expected: false)`);
  if (!validCoord || invalidLat || invalidLng) throw new Error('Coordinate validation failed');

  // Test 2: Turf Distance Calculation
  console.log('\n[Test 2] Turf Distance Calculation:');
  // Bangalore MG Road (12.9756, 77.6066) to Indiranagar (12.9784, 77.6408) is ~3.7 km
  const distKm = TrackingService.calculateDistanceKm(12.9756, 77.6066, 12.9784, 77.6408);
  console.log(`  - Distance between MG Road and Indiranagar: ${distKm} km (Expected: ~3.7 km)`);
  if (distKm < 3.0 || distKm > 4.5) throw new Error(`Unexpected distance calculated: ${distKm} km`);

  // Test 3: Realistic Movement vs Outlier Jump Rejection
  console.log('\n[Test 3] Outlier GPS Jump Rejection:');
  const t0 = new Date('2026-09-01T09:00:00Z');
  const t1 = new Date('2026-09-01T09:01:00Z'); // 60 seconds later

  // Normal city driving (1 km in 60s = 60 km/h)
  const normalMove = TrackingService.isValidMovement(
    { latitude: 12.9756, longitude: 77.6066, timestamp: t0, accuracy: 10 },
    { latitude: 12.9846, longitude: 77.6066, timestamp: t1, accuracy: 12 }
  );
  console.log(`  - Normal movement (60 km/h) accepted: ${normalMove} (Expected: true)`);

  // Impossible teleportation jump (500 km in 60s = 30,000 km/h)
  const outlierJump = TrackingService.isValidMovement(
    { latitude: 12.9756, longitude: 77.6066, timestamp: t0, accuracy: 10 },
    { latitude: 17.3850, longitude: 78.4867, timestamp: t1, accuracy: 10 } // Hyderabad jump
  );
  console.log(`  - Impossible jump (500 km in 60s) accepted: ${outlierJump} (Expected: false)`);

  // Unreliable GPS fix (> 150m accuracy)
  const poorAccuracy = TrackingService.isValidMovement(
    { latitude: 12.9756, longitude: 77.6066, timestamp: t0, accuracy: 10 },
    { latitude: 12.9760, longitude: 77.6068, timestamp: t1, accuracy: 250 }
  );
  console.log(`  - Poor accuracy fix (> 150m) accepted: ${poorAccuracy} (Expected: false)`);

  if (!normalMove || outlierJump || poorAccuracy) throw new Error('Movement validation logic failed');

  console.log('\n✅ ALL TRACKING SERVICE TESTS PASSED SUCCESSFULLY!');
}

runTrackingTests().catch((err) => {
  console.error('❌ Tracking tests failed:', err);
  process.exit(1);
});

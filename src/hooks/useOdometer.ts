import { useRef, useState, useEffect } from 'react';
import type * as Location from 'expo-location';
import { createOdometer } from '@/engine/odometer';

export function useOdometer(location: Location.LocationObject | null): number {
  const odoRef = useRef(createOdometer());
  const [totalKm, setTotalKm] = useState(0);

  useEffect(() => {
    if (!location) return;
    const { latitude, longitude } = location.coords;
    odoRef.current.update(latitude, longitude);
    setTotalKm(odoRef.current.getKm());
  }, [location]);

  return totalKm;
}

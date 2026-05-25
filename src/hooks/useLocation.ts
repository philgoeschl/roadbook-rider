import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';

export interface LocationState {
  location: Location.LocationObject | null;
  heading: number | null; // degrees 0-360, null until first reading
  permissionStatus: Location.PermissionStatus | null;
  requestPermission: () => Promise<boolean>;
}

export function useLocation(): LocationState {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (!active) return;
      setPermissionStatus(status);

      if (status === Location.PermissionStatus.GRANTED) {
        await startWatching();
      }
    })();

    return () => {
      active = false;
      subscriptionRef.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startWatching() {
    subscriptionRef.current?.remove();
    subscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5, // update every 5m of movement
      },
      (loc) => {
        setLocation(loc);
        const h = loc.coords.heading;
        if (h !== null && h >= 0) setHeading(h);
      },
    );
  }

  async function requestPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(status);
    if (status === Location.PermissionStatus.GRANTED) {
      await startWatching();
      return true;
    }
    return false;
  }

  return { location, heading, permissionStatus, requestPermission };
}

import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export type CampusLocation = {
  lat: number;
  lng: number;
};

type CampusMapProps = {
  onLocationSelect?: (location: CampusLocation) => void;
};

const CAMPUS_CENTER: CampusLocation = {
  lat: 17.5449,
  lng: 78.5718,
};

const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const missingApiKeyMessage =
  "Google Maps API key is missing. Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env, then restart Vite.";

export default function CampusMap({ onLocationSelect }: CampusMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const callbackRef = useRef(onLocationSelect);
  const [selectedLocation, setSelectedLocation] = useState<CampusLocation | null>(null);
  const [error, setError] = useState("");

  // Keep the latest callback without recreating the map whenever the parent renders.
  useEffect(() => {
    callbackRef.current = onLocationSelect;
  }, [onLocationSelect]);

  useEffect(() => {
    if (!mapsApiKey) return;

    let cancelled = false;
    let clickListener: google.maps.MapsEventListener | undefined;

    async function loadMap() {
      try {
        setOptions({ key: mapsApiKey, v: "weekly" });
        const { Map } = await importLibrary("maps");

        if (cancelled || !mapElementRef.current) return;

        const map = new Map(mapElementRef.current, {
          center: CAMPUS_CENTER,
          zoom: 16,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });

        clickListener = map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return;

          const location = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          setSelectedLocation(location);

          if (markerRef.current) markerRef.current.setMap(null);
          markerRef.current = new google.maps.Marker({
            map,
            position: location,
            title: "Selected item location",
          });

          callbackRef.current?.(location);
        });
      } catch (loadError) {
        console.error("Google Maps failed to load:", loadError);
        if (!cancelled) setError("Google Maps could not load. Check that the Maps JavaScript API is enabled and that the API key restrictions allow this site.");
      }
    }

    void loadMap();

    return () => {
      cancelled = true;
      clickListener?.remove();
      markerRef.current?.setMap(null);
      markerRef.current = null;
    };
  }, []);

  const mapError = !mapsApiKey ? missingApiKeyMessage : error;

  if (mapError) {
    return <div className="map-error"><strong>Map unavailable</strong><p>{mapError}</p></div>;
  }

  return (
    <div className="campus-map">
      <div ref={mapElementRef} className="map-canvas" />
      <p className="map-help">Click the map to select where the item was lost, found, or last seen.</p>
      {selectedLocation && (
        <div className="selected-location">
          <strong>Selected location</strong>
          <span>Latitude: {selectedLocation.lat.toFixed(6)}</span>
          <span>Longitude: {selectedLocation.lng.toFixed(6)}</span>
        </div>
      )}
    </div>
  );
}

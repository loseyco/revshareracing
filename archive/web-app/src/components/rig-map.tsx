"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import "leaflet/dist/leaflet.css";

type Rig = {
  device_id: string;
  device_name: string;
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
  iracing_connected?: boolean;
  last_seen?: string;
  claimed?: boolean;
};

export function RigMap() {
  const [rigs, setRigs] = useState<Rig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    fetchRigs();
  }, []);

  useEffect(() => {
    // Only initialize map once when we have the container and data is loaded
    if (!loading && mapContainerRef.current && !mapRef.current) {
      initializeMap();
    }
    
    // Cleanup function to destroy map on unmount
    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          // Map might already be removed
          console.warn("Error removing map:", e);
        }
        mapRef.current = null;
        markersRef.current = [];
      }
    };
  }, [loading]);

  // Separate effect to update markers when rigs change (but only if map exists)
  useEffect(() => {
    if (mapRef.current && !loading && rigs.length >= 0) {
      updateMarkers();
    }
  }, [rigs, loading]);

  const fetchRigs = async () => {
    try {
      // Public endpoint - no authentication required
      const response = await fetch("/api/rigs/map");
      if (!response.ok) {
        throw new Error("Failed to fetch rigs");
      }
      const data = await response.json();
      console.log("[RigMap] Fetched rigs from API:", data.rigs?.length || 0);
      if (data.rigs && data.rigs.length > 0) {
        console.log("[RigMap] Rigs data:", data.rigs.map((r: any) => ({
          device_id: r.device_id,
          device_name: r.device_name,
          lat: r.latitude,
          lon: r.longitude,
          city: r.city,
          claimed: r.claimed
        })));
      }
      setRigs(data.rigs || []);
    } catch (err) {
      console.error("Failed to fetch rigs:", err);
      setError("Failed to load rig locations");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to check if rig is online (must be defined before use)
  const isRigOnline = (lastSeen?: string): boolean => {
    if (!lastSeen) return false;
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffSeconds = (now.getTime() - lastSeenDate.getTime()) / 1000;
    return diffSeconds < 60; // Online if seen within last 60 seconds
  };

  const updateMarkers = async () => {
    if (!mapRef.current) {
      console.log("[RigMap] updateMarkers: Map not initialized yet");
      return;
    }
    
    if (rigs.length === 0) {
      console.log("[RigMap] updateMarkers: No rigs to display, clearing markers");
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      return;
    }
    
    console.log(`[RigMap] updateMarkers: Adding ${rigs.length} markers to map`);
    
    // Dynamically import Leaflet
    const L = await import("leaflet");
    
    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add markers for each rig
    rigs.forEach((rig, index) => {
      // Validate coordinates before creating marker
      if (!rig.latitude || !rig.longitude || 
          isNaN(rig.latitude) || isNaN(rig.longitude) ||
          !isFinite(rig.latitude) || !isFinite(rig.longitude)) {
        console.warn(`[RigMap] Skipping rig ${rig.device_id} due to invalid coordinates: lat=${rig.latitude}, lon=${rig.longitude}`);
        return;
      }
      
      console.log(`[RigMap] Adding marker ${index + 1}/${rigs.length}: ${rig.device_name || rig.device_id} at (${rig.latitude}, ${rig.longitude})`);
      
      const isOnline = isRigOnline(rig.last_seen);
      // Color coding: green (online+connected), yellow (unclaimed), gray (offline/not connected)
      let iconColor = "#6b7280"; // default gray
      if (!rig.claimed) {
        iconColor = "#eab308"; // yellow for unclaimed
      } else if (isOnline && rig.iracing_connected) {
        iconColor = "#10b981"; // green for online and connected
      }

      // Create custom icon
      const icon = L.default.divIcon({
        className: "custom-marker",
        html: `
          <div style="
            background-color: ${iconColor};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
          "></div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const location = [rig.city, rig.region, rig.country].filter(Boolean).join(", ") || "Unknown Location";
      const statusText = !rig.claimed 
        ? "Unclaimed" 
        : isOnline && rig.iracing_connected 
          ? "Online & Connected" 
          : isOnline 
            ? "Online" 
            : "Offline";
      
      const popupContent = `
        <div style="min-width: 180px; max-width: 250px;">
          <div style="font-weight: bold; margin-bottom: 4px; font-size: 0.9rem; word-wrap: break-word;">${rig.device_name || rig.device_id}</div>
          <div style="font-size: 0.75rem; color: #6b7280; margin-bottom: 8px; word-wrap: break-word;">${location}</div>
          <div style="font-size: 0.7rem; margin-bottom: 4px;">
            <span style="color: ${iconColor};">●</span> ${statusText}
          </div>
          <a href="/device/${rig.device_id}${rig.claimed ? '/details' : ''}" style="
            display: inline-block;
            margin-top: 8px;
            padding: 6px 12px;
            background-color: #dc2626;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-size: 0.8rem;
            text-align: center;
            width: 100%;
            box-sizing: border-box;
          ">${rig.claimed ? 'View Details' : 'Claim Device'}</a>
        </div>
      `;

      try {
        const marker = L.default.marker([rig.latitude, rig.longitude], { icon })
          .addTo(mapRef.current)
          .bindPopup(popupContent);

        markersRef.current.push(marker);
        console.log(`[RigMap] Successfully added marker for ${rig.device_name || rig.device_id}`);
      } catch (error) {
        console.error(`[RigMap] Error adding marker for ${rig.device_name || rig.device_id}:`, error);
      }
    });
    
    console.log(`[RigMap] Total markers added: ${markersRef.current.length}`);
    
    // Adjust map view if needed
    if (rigs.length > 0) {
      const validRigs = rigs.filter(r => 
        r.latitude && r.longitude && 
        !isNaN(r.latitude) && !isNaN(r.longitude) &&
        isFinite(r.latitude) && isFinite(r.longitude)
      );
      
      if (validRigs.length > 0) {
        const avgLat = validRigs.reduce((sum, rig) => sum + rig.latitude, 0) / validRigs.length;
        const avgLon = validRigs.reduce((sum, rig) => sum + rig.longitude, 0) / validRigs.length;
        mapRef.current.setView([avgLat, avgLon], validRigs.length === 1 ? 10 : 6);
        console.log(`[RigMap] Map view set to (${avgLat}, ${avgLon}) with zoom based on ${validRigs.length} rigs`);
      }
    }
  };

  const initializeMap = async () => {
    // Prevent double initialization
    if (mapRef.current || !mapContainerRef.current) {
      return;
    }

    // Check if container already has a Leaflet map instance
    if ((mapContainerRef.current as any)._leaflet_id) {
      console.warn("Map container already initialized, skipping");
      return;
    }

    // Dynamically import Leaflet only on client side
    const L = await import("leaflet");

    // Double-check after async import
    if (mapRef.current || !mapContainerRef.current || (mapContainerRef.current as any)._leaflet_id) {
      return;
    }

    // Calculate center point (average of all rig locations, or default to center of US)
    let centerLat = 39.8283;
    let centerLon = -98.5795;
    let zoom = 4;

    if (rigs.length > 0) {
      const avgLat = rigs.reduce((sum, rig) => sum + rig.latitude, 0) / rigs.length;
      const avgLon = rigs.reduce((sum, rig) => sum + rig.longitude, 0) / rigs.length;
      centerLat = avgLat;
      centerLon = avgLon;
      zoom = rigs.length === 1 ? 10 : 6;
    }

    // Initialize map
    const map = L.default.map(mapContainerRef.current).setView([centerLat, centerLon], zoom);
    mapRef.current = map;

    // Add OpenStreetMap tiles
    L.default.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Fix Leaflet default icon issue in Next.js
    delete (L.default.Icon.Default.prototype as any)._getIconUrl;
    L.default.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });

    // Initial markers will be added by updateMarkers after map is ready
    // Use setTimeout to ensure map is fully initialized
    setTimeout(() => {
      if (rigs.length > 0 && mapRef.current) {
        console.log("[RigMap] initializeMap: Calling updateMarkers after map initialization");
        updateMarkers();
      }
    }, 100);
  };

  if (loading) {
    return (
      <div className="glass rounded-xl sm:rounded-2xl p-6 sm:p-8 w-full">
        <div className="flex items-center justify-center h-64 sm:h-96">
          <div className="flex items-center gap-2 text-slate-400 text-sm sm:text-base">
            <div className="h-4 w-4 sm:h-5 sm:w-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
            <span>Loading rig locations...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-xl sm:rounded-2xl p-6 sm:p-8 w-full">
        <div className="text-center text-slate-400 text-sm sm:text-base">{error}</div>
      </div>
    );
  }

  if (rigs.length === 0) {
    return (
      <div className="glass rounded-xl sm:rounded-2xl p-6 sm:p-8 w-full">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Rig Locations</h2>
        <div className="text-center text-slate-400 py-8 sm:py-12 text-sm sm:text-base">
          No rigs with location data available yet
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 w-full">
      <div className="mb-3 sm:mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Rig Locations</h2>
        <p className="text-slate-400 text-xs sm:text-sm">
          {rigs.length} {rigs.length === 1 ? "rig" : "rigs"} with location data
        </p>
      </div>
      <div
        ref={mapContainerRef}
        className="w-full rounded-lg sm:rounded-xl"
        style={{ height: "300px", zIndex: 0 }}
      />
      <style jsx global>{`
        .custom-marker {
          background: transparent;
          border: none;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
        }
        .leaflet-container {
          font-family: inherit;
        }
      `}</style>
    </div>
  );
}


import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Hook to subscribe to Supabase Realtime changes
 * 
 * @param supabase - Supabase client
 * @param table - Table name to subscribe to
 * @param callback - Callback function when changes occur
 * @param filter - Optional filter (e.g., { device_id: 'xxx' })
 */
export function useRealtimeSubscription(
  supabase: any,
  table: string,
  callback: (payload: any) => void,
  filter?: Record<string, any>
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!supabase) return;

    // Create unique channel name
    const channelName = filter
      ? `${table}:${Object.entries(filter).map(([k, v]) => `${k}=${v}`).join(":")}:${Date.now()}`
      : `${table}:*:${Date.now()}`;

    // Build filter string for Supabase
    let filterString: string | undefined = undefined;
    if (filter) {
      filterString = Object.entries(filter)
        .map(([key, value]) => `${key}=eq.${value}`)
        .join("&");
    }

    // Create subscription
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: table,
          ...(filterString ? { filter: filterString } : {})
        },
        (payload: any) => {
          callback(payload);
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          console.log(`[Realtime] Subscribed to ${table}${filter ? ` with filter ${JSON.stringify(filter)}` : ""}`);
        } else if (status === "CHANNEL_ERROR") {
          console.error(`[Realtime] Error subscribing to ${table}`);
        } else if (status === "TIMED_OUT") {
          console.warn(`[Realtime] Subscription to ${table} timed out`);
        }
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase, table, JSON.stringify(filter)]);

  return channelRef.current;
}


import { useState, useCallback } from "react";
import firebaseConfig from "../../firebase-applet-config.json";
import { syncWeekToCalendar } from "../lib/googleCalendar";

export function useGoogleCalendarSync() {
  const [isSyncing, setIsSyncing] = useState(false);

  const sync = useCallback(async (mealPlan: any[], language: string) => {
    setIsSyncing(true);
    try {
      // @ts-ignore
      const client = google.accounts.oauth2.initTokenClient({
        client_id: firebaseConfig.oAuthClientId,
        scope: "https://www.googleapis.com/auth/calendar.events",
        callback: async (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            await syncWeekToCalendar(tokenResponse.access_token, mealPlan, language);
            alert("¡Menú sincronizado con Google Calendar!");
          }
          setIsSyncing(false);
        },
      });
      client.requestAccessToken();
    } catch (error) {
      console.error("Error syncing to calendar", error);
      setIsSyncing(false);
      alert("Error al sincronizar con el calendario.");
    }
  }, []);

  return { sync, isSyncing };
}

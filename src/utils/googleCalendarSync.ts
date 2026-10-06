import firebaseConfig from "../../firebase-applet-config.json";
import type { Language, MealPlanDay } from "../types";

export async function syncWeekToGoogleCalendar(mealPlan: MealPlanDay[], language: Language): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    try {
      // Google Identity Services is loaded by the application shell.
      // @ts-ignore
      const client = google.accounts.oauth2.initTokenClient({
        client_id: firebaseConfig.oAuthClientId,
        scope: "https://www.googleapis.com/auth/calendar.events",
        callback: async (tokenResponse: { access_token?: string }) => {
          try {
            if (!tokenResponse?.access_token) {
              resolve();
              return;
            }
            const { syncWeekToCalendar } = await import("../lib/googleCalendar");
            await syncWeekToCalendar(tokenResponse.access_token, mealPlan, language);
            alert("¡Menú sincronizado con Google Calendar!");
            resolve();
          } catch (error) {
            reject(error);
          }
        },
      });
      client.requestAccessToken();
    } catch (error) {
      reject(error);
    }
  }).catch((error) => {
    console.error("Error syncing to calendar", error);
    alert("Error al sincronizar con el calendario.");
  });
}

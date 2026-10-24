import type { Language } from "../types";

export interface LocalResetCopy {
  buttonLabel: string;
  title: string;
  description: string;
  confirmText: string;
}

const signedInCopy: Record<Language, LocalResetCopy> = {
  en: {
    buttonLabel: "Clear local app data",
    title: "Clear local app data",
    description:
      "This removes BalkanBite data cached in this browser or device only, including any guest pantry recovery backups. Download recovery copies before clearing. Data stored in your signed-in cloud account is not deleted and may sync back after reload.",
    confirmText: "Clear local data",
  },
  es: {
    buttonLabel: "Borrar datos locales",
    title: "Borrar datos locales",
    description:
      "Esto elimina solo los datos de BalkanBite guardados en este navegador o dispositivo, incluidas las copias de recuperación de la despensa invitada. Descárgalas antes de borrar. Los datos de tu cuenta sincronizada en la nube no se eliminan y pueden volver a sincronizarse al recargar.",
    confirmText: "Borrar datos locales",
  },
  bg: {
    buttonLabel: "Изтрий локалните данни",
    title: "Изтриване на локалните данни",
    description:
      "Това изтрива само данните на BalkanBite в този браузър или устройство, включително резервните копия за възстановяване на гост-деспенсата. Изтеглете копията преди изтриване. Данните в синхронизирания ви облачен акаунт не се изтриват и могат да се синхронизират отново след презареждане.",
    confirmText: "Изтрий локалните данни",
  },
};

const guestCopy: Record<Language, LocalResetCopy> = {
  en: {
    buttonLabel: "Reset local app data",
    title: "Reset local app data",
    description:
      "This removes BalkanBite data stored locally in this browser or device, including guest pantry recovery backups. Download the backups before resetting. It does not delete data from any cloud account.",
    confirmText: "Reset local data",
  },
  es: {
    buttonLabel: "Restablecer datos locales",
    title: "Restablecer datos locales",
    description:
      "Esto elimina los datos de BalkanBite guardados localmente en este navegador o dispositivo, incluidas las copias de recuperación de la despensa invitada. Descárgalas antes de restablecer. No elimina datos de ninguna cuenta en la nube.",
    confirmText: "Restablecer datos locales",
  },
  bg: {
    buttonLabel: "Нулирай локалните данни",
    title: "Нулиране на локалните данни",
    description:
      "Това изтрива данните на BalkanBite, запазени локално в този браузър или устройство, включително резервните копия за възстановяване на гост-деспенсата. Изтеглете ги преди нулиране. Не изтрива данни от облачен акаунт.",
    confirmText: "Нулирай локалните данни",
  },
};

export function getLocalResetCopy(
  language: Language,
  hasSignedInCloudAccount: boolean,
): LocalResetCopy {
  return (hasSignedInCloudAccount ? signedInCopy : guestCopy)[language];
}

// src/lib/profileConfigValidation.ts
//
// C4 del PLAN_INTEGRACIONES: validación de /profileConfig antes de guardar.
//
// Vive aparte de la sección (y sin dependencias de React) porque se usa en DOS
// sitios que no pueden discrepar: el resumen que se pinta y la puerta que
// decide si el cambio llega a Firebase. Si cada uno calculara lo suyo,
// acabarían divergiendo y el panel diría "todo bien" mientras bloquea, o al
// revés.
//
// La distinción importante:
//   · error   → la app va a IGNORAR eso en silencio. No falla nada, no se ve
//               ningún síntoma: simplemente no pasa lo que el admin esperaba.
//               Por eso se bloquea el guardado — es el fallo más caro de
//               diagnosticar de todo el sistema de perfiles.
//   · warning → sospechoso, pero puede ser intencionado. Solo se avisa.

import { slugify } from '@/lib/profileCatalog';
import type { ProfileConfigData } from '@/types/profileConfig';

export interface ProfileConfigIssues {
  errors: string[];
  warnings: string[];
}

/** Semver estricto `X.Y.Z`, que es lo que compara `isAppVersionSupported()`. */
const SEMVER = /^\d+\.\d+\.\d+$/;

export function validateProfileConfig(
  draft: ProfileConfigData,
  calendars: Array<{ id: string; name: string }>,
): ProfileConfigIssues {
  const errors: string[] = [];
  const warnings: string[] = [];

  Object.entries(draft.profiles ?? {}).forEach(([type, p]) => {
    if (!p.tabs?.length) {
      warnings.push(`Perfil "${type}" no tiene tabs.`);
    } else if (!p.tabs.includes('index')) {
      // La app arranca en `defaultTab` y espera la Home entre las tabs.
      warnings.push(`Perfil "${type}": sus tabs no incluyen "index" (la Home).`);
    }
    p.defaultCalendars?.forEach((id) => {
      if (!calendars.some((c) => c.id === id)) {
        warnings.push(
          `Perfil "${type}": calendario "${id}" no existe en /calendars.`,
        );
      }
    });
  });

  // Claves de override: la app las busca EXACTAMENTE como `perfil:delegacion`
  // (mcm-app/utils/resolveProfileConfig.ts). Un typo no da error en ningún
  // sitio; el override simplemente no se aplica nunca.
  const knownProfiles = Object.keys(draft.profiles ?? {});
  Object.keys(draft.overrides ?? {}).forEach((key) => {
    const parts = key.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      errors.push(
        `Override "${key}": el formato debe ser "perfil:delegacion". La app no lo aplicará.`,
      );
      return;
    }
    const [profileType, delegationId] = parts;
    if (!knownProfiles.includes(profileType)) {
      errors.push(
        `Override "${key}": el perfil "${profileType}" no existe. La app no lo aplicará.`,
      );
    }
    if (!draft.delegations?.[delegationId]) {
      errors.push(
        `Override "${key}": la delegación "${delegationId}" no existe. La app no lo aplicará.`,
      );
    }
  });

  // minAppVersion: la app es "fail-open" a propósito (un semver inválido NO
  // bloquea a nadie), así que esto no deja a la gente fuera — te deja creyendo
  // que tienes un kill-switch que en realidad no existe.
  const minVersion = draft.global?.minAppVersion?.trim();
  if (minVersion && !SEMVER.test(minVersion)) {
    errors.push(
      `minAppVersion "${minVersion}" no es un semver X.Y.Z: la app lo ignora y no bloqueará ninguna versión.`,
    );
  }

  // Los topics de push no admiten espacios, acentos ni mayúsculas. El editor
  // slugifica al guardar, pero un JSON importado a mano puede traerlos sucios.
  Object.entries(draft.delegations ?? {}).forEach(([id, d]) => {
    const topic = d?.notificationTopic;
    if (topic && topic !== slugify(topic)) {
      errors.push(
        `Delegación "${id}": el topic "${topic}" no es válido (debería ser "${slugify(topic)}").`,
      );
    }
  });

  return { errors, warnings };
}

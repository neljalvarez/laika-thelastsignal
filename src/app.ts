/** Shared services, created once in main.ts and used by scenes and UI. */
import type { AudioManager } from "./audio/AudioManager";
import type { InputManager } from "./input/InputManager";
import type { KeyValueStore } from "./systems/save";
import { saveSettings, type Settings } from "./systems/settings";
import type { UI } from "./ui/UI";

export interface Services {
  store: KeyValueStore | null;
  settings: Settings;
  audio: AudioManager;
  input: InputManager;
  ui: UI;
  /** Listeners notified after settings change (scenes re-read tuning, touch layout, etc.). */
  settingsListeners: Set<(s: Settings) => void>;
}

let services: Services | null = null;

export function setServices(s: Services): void {
  services = s;
}

export function svc(): Services {
  if (!services) throw new Error("Services not initialised");
  return services;
}

export function updateSettings(next: Settings): void {
  const s = svc();
  s.settings = next;
  saveSettings(s.store, next);
  s.audio.applySettings(next);
  s.input.setBindings(next);
  s.ui.applySettings(next);
  for (const l of s.settingsListeners) l(next);
}

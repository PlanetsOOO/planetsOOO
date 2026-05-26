/** Shared keyboard state for flight + autopilot (updated by FlightControls). */
export const inputKeys = new Set<string>();

export function clearInputKeys() {
  inputKeys.clear();
}

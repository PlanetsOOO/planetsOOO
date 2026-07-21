/** Orbit Online craft feel — tighter than Basic free-flight. */

export interface OnlineFlightFeel {
  /** Scales BASE_MAX_THRUST / response for snappier craft. */
  thrustResponse: number;
  coastResponse: number;
  maxThrust: number;
  maxSpeed: number;
  lookSensitivity: number;
  /** Degrees — slightly narrower than Basic for cockpit framing. */
  baseFov: number;
  rollSpeed: number;
}

export const ONLINE_FLIGHT_FEEL: OnlineFlightFeel = {
  thrustResponse: 4.2,
  coastResponse: 2.2,
  maxThrust: 1.35,
  maxSpeed: 1.15,
  lookSensitivity: 0.0026,
  baseFov: 48,
  rollSpeed: 1.35,
};

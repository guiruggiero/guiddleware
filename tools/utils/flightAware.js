// Import
import {createRetryClient} from "./axiosClient.js";

// Axios instance for FlightAware AeroAPI
const aeroApiClient = createRetryClient({
  baseURL: "https://aeroapi.flightaware.com/aeroapi",
  timeout: 8000,
  headers: {"x-apikey": process.env.FLIGHTAWARE_AEROAPI_KEY},
});

// IATA flight number: 2-3 letter/digit airline code + 1-4 digit number
const IATA_FLIGHT_NUMBER = /^[A-Z0-9]{2,3}[0-9]{1,4}$/;

// Resolves an IATA flight number to a FlightAware live-tracking URL
export const getFlightAwareUrl = async (flightNumber) => {
  if (!IATA_FLIGHT_NUMBER.test(flightNumber)) return null;

  const res = await aeroApiClient.get(`/flights/${flightNumber}`);
  const icao = res.data?.flights?.[0]?.ident_icao;
  return icao ?
    `https://www.flightaware.com/live/flight/${icao}` : null;
};

// Import
import {createRetryClient} from "./axiosClient.js";

// Axios instance for Adafruit IO
const adafruitClient = createRetryClient({
  baseURL: "https://io.adafruit.com/api/v2/guiruggiero",
  timeout: 8000,
  headers: {"X-AIO-Key": process.env.ADAFRUIT_IO_KEY},
});

// Writes a value to the `on-air-sign` feed
export const setSignFeed = async (value) => {
  await adafruitClient.post("/feeds/on-air-sign/data", {value});
};

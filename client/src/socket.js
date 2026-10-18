import { io } from "socket.io-client";
import { SERVER_URL, TOKEN_KEY } from "./config";

export const socket = io(SERVER_URL, {
  autoConnect: false,
  auth: (cb) => cb({ token: localStorage.getItem(TOKEN_KEY) }),
});

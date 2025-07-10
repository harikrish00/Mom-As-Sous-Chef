import React from "react";
import App from "../App";
import { TranscriptProvider } from "../contexts/TranscriptContext";
import { EventProvider } from "../contexts/EventContext";

export default function AppPage() {
  return (
    <EventProvider>
      <TranscriptProvider>
        <App />
      </TranscriptProvider>
    </EventProvider>
  );
}

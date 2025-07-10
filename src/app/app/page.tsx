import React, { Suspense } from "react";
import App from "../App";
import { TranscriptProvider } from "../contexts/TranscriptContext";
import { EventProvider } from "../contexts/EventContext";

function AppPage() {
  return (
    <EventProvider>
      <TranscriptProvider>
        <Suspense fallback={<div>Loading...</div>}>
          <App />
        </Suspense>
      </TranscriptProvider>
    </EventProvider>
  );
}

export default AppPage;

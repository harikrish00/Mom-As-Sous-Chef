"use client";
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import Image from "next/image";

// UI components
import Transcript from "./components/Transcript";

// Types
import { SessionStatus } from "@/app/types";
import type { RealtimeAgent } from "@openai/agents/realtime";

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import { createModerationGuardrail } from "@/app/agentConfigs/guardrails";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";
import { customerServiceRetailScenario } from "@/app/agentConfigs/customerServiceRetail";
import { chatSupervisorScenario } from "@/app/agentConfigs/chatSupervisor";
import { customerServiceRetailCompanyName } from "@/app/agentConfigs/customerServiceRetail";
import { chatSupervisorCompanyName } from "@/app/agentConfigs/chatSupervisor";
import { simpleHandoffScenario } from "@/app/agentConfigs/simpleHandoff";

// Map used by connect logic for scenarios defined via the SDK.
const sdkScenarioMap: Record<string, RealtimeAgent[]> = {
  simpleHandoff: simpleHandoffScenario,
  customerServiceRetail: customerServiceRetailScenario,
  chatSupervisor: chatSupervisorScenario,
};

import useAudioDownload from "./hooks/useAudioDownload";
import { useHandleSessionHistory } from "./hooks/useHandleSessionHistory";

function App() {
  const searchParams = useSearchParams()!;

  const { addTranscriptMessage, addTranscriptBreadcrumb } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<
    RealtimeAgent[] | null
  >(null);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  // Ref to identify whether the latest agent switch came from an automatic handoff
  const handoffTriggeredRef = useRef(false);

  const sdkAudioElement = React.useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const el = document.createElement("audio");
    el.autoplay = true;
    el.style.display = "none";
    document.body.appendChild(el);
    return el;
  }, []);

  // Attach SDK audio element once it exists (after first render in browser)
  useEffect(() => {
    if (sdkAudioElement && !audioElementRef.current) {
      audioElementRef.current = sdkAudioElement;
    }
  }, [sdkAudioElement]);

  const { connect, disconnect, sendUserText, sendEvent, interrupt, mute } =
    useRealtimeSession({
      onConnectionChange: (s) => setSessionStatus(s as SessionStatus),
      onAgentHandoff: (agentName: string) => {
        handoffTriggeredRef.current = true;
        setSelectedAgentName(agentName);
      },
    });

  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("DISCONNECTED");

  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(
    () => {
      if (typeof window === "undefined") return true;
      const stored = localStorage.getItem("audioPlaybackEnabled");
      return stored ? stored === "true" : true;
    }
  );

  // Initialize the recording hook.
  const { startRecording, stopRecording, downloadRecording } =
    useAudioDownload();

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    try {
      sendEvent(eventObj);
      logClientEvent(eventObj, eventNameSuffix);
    } catch (err) {
      console.error("Failed to send via SDK", err);
    }
  };

  useHandleSessionHistory();

  useEffect(() => {
    let finalAgentConfig = searchParams.get("agentConfig");
    if (!finalAgentConfig || !allAgentSets[finalAgentConfig]) {
      finalAgentConfig = defaultAgentSetKey;
      const url = new URL(window.location.toString());
      url.searchParams.set("agentConfig", finalAgentConfig);
      window.location.replace(url.toString());
      return;
    }

    const agents = allAgentSets[finalAgentConfig];
    const agentKeyToUse = agents[0]?.name || "";

    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(agents);
  }, [searchParams]);

  useEffect(() => {
    if (selectedAgentName && sessionStatus === "DISCONNECTED") {
      connectToRealtime();
    }
  }, [selectedAgentName]);

  useEffect(() => {
    if (
      sessionStatus === "CONNECTED" &&
      selectedAgentConfigSet &&
      selectedAgentName
    ) {
      const currentAgent = selectedAgentConfigSet.find(
        (a) => a.name === selectedAgentName
      );
      addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
      updateSession(!handoffTriggeredRef.current);
      // Reset flag after handling so subsequent effects behave normally
      handoffTriggeredRef.current = false;
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus]);

  const fetchEphemeralKey = async (): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }

    return data.client_secret.value;
  };

  const connectToRealtime = async () => {
    const agentSetKey = searchParams.get("agentConfig") || "default";
    if (sdkScenarioMap[agentSetKey]) {
      if (sessionStatus !== "DISCONNECTED") return;
      setSessionStatus("CONNECTING");

      try {
        const EPHEMERAL_KEY = await fetchEphemeralKey();
        if (!EPHEMERAL_KEY) return;

        // Ensure the selectedAgentName is first so that it becomes the root
        const reorderedAgents = [...sdkScenarioMap[agentSetKey]];
        const idx = reorderedAgents.findIndex(
          (a) => a.name === selectedAgentName
        );
        if (idx > 0) {
          const [agent] = reorderedAgents.splice(idx, 1);
          reorderedAgents.unshift(agent);
        }

        const companyName =
          agentSetKey === "customerServiceRetail"
            ? customerServiceRetailCompanyName
            : chatSupervisorCompanyName;
        const guardrail = createModerationGuardrail(companyName);

        await connect({
          getEphemeralKey: async () => EPHEMERAL_KEY,
          initialAgents: reorderedAgents,
          audioElement: sdkAudioElement,
          outputGuardrails: [guardrail],
          extraContext: {
            addTranscriptBreadcrumb,
          },
        });
      } catch (err) {
        console.error("Error connecting via SDK:", err);
        setSessionStatus("DISCONNECTED");
      }
      return;
    }
  };

  const disconnectFromRealtime = () => {
    disconnect();
    setSessionStatus("DISCONNECTED");
    setIsPTTUserSpeaking(false);
  };

  const sendSimulatedUserMessage = (text: string) => {
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);

    sendClientEvent({
      type: "conversation.item.create",
      item: {
        id,
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });
    sendClientEvent(
      { type: "response.create" },
      "(simulated user text message)"
    );
  };

  const updateSession = (shouldTriggerResponse: boolean = false) => {
    // Configure server VAD for automatic turn detection
    const turnDetection = {
      type: "server_vad",
      threshold: 0.9,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
      create_response: true,
    };

    sendEvent({
      type: "session.update",
      session: {
        turn_detection: turnDetection,
      },
    });

    // Send an initial 'hi' message to trigger the agent to greet the user
    if (shouldTriggerResponse) {
      sendSimulatedUserMessage("hi");
    }
    return;
  };

  const handleTalkButtonDown = () => {
    if (sessionStatus !== "CONNECTED") return;
    interrupt();

    setIsPTTUserSpeaking(true);
    sendClientEvent({ type: "input_audio_buffer.clear" }, "clear PTT buffer");
  };

  const handleTalkButtonUp = () => {
    if (sessionStatus !== "CONNECTED" || !isPTTUserSpeaking) return;

    setIsPTTUserSpeaking(false);
    sendClientEvent({ type: "input_audio_buffer.commit" }, "commit PTT");
    sendClientEvent({ type: "response.create" }, "trigger response PTT");
  };

  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.muted = false;
        audioElementRef.current.play().catch((err) => {
          console.warn("Autoplay may be blocked by browser:", err);
        });
      } else {
        // Mute and pause to avoid brief audio blips before pause takes effect.
        audioElementRef.current.muted = true;
        audioElementRef.current.pause();
      }
    }

    // Toggle server-side audio stream mute so bandwidth is saved when the
    // user disables playback.
    try {
      mute(!isAudioPlaybackEnabled);
    } catch (err) {
      console.warn("Failed to toggle SDK mute", err);
    }
  }, [isAudioPlaybackEnabled]);

  // Ensure mute state is propagated to transport right after we connect or
  // whenever the SDK client reference becomes available.
  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      try {
        mute(!isAudioPlaybackEnabled);
      } catch (err) {
        console.warn("mute sync after connect failed", err);
      }
    }
  }, [sessionStatus, isAudioPlaybackEnabled]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED" && audioElementRef.current?.srcObject) {
      // The remote audio stream from the audio element.
      const remoteStream = audioElementRef.current.srcObject as MediaStream;
      startRecording(remoteStream);
    }

    // Clean up on unmount or when sessionStatus is updated.
    return () => {
      stopRecording();
    };
  }, [sessionStatus]);

  const isConnected = sessionStatus === "CONNECTED";
  const isConnecting = sessionStatus === "CONNECTING";

  return (
    <div className="text-base flex flex-col h-screen bg-gray-100 text-gray-800 relative">
      {/* Header */}
      <div className="p-5 text-lg font-semibold flex justify-between items-center">
        <div className="flex items-center">
          <div>
            <Image
              src="/openai-logomark.svg"
              alt="OpenAI Logo"
              width={20}
              height={20}
              className="mr-2"
            />
          </div>
          <div>
            Realtime API <span className="text-gray-500">Agents</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            {isConnecting
              ? "Connecting..."
              : isConnected
              ? "Connected"
              : "Disconnected"}
          </div>
          <button
            onClick={isConnected ? disconnectFromRealtime : connectToRealtime}
            disabled={isConnecting}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              isConnected
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-black hover:bg-gray-900 text-white"
            } ${isConnecting ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isConnected ? "Disconnect" : "Connect"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 px-4 pb-4 overflow-hidden">
        {/* Speak Button */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <button
              onMouseDown={handleTalkButtonDown}
              onMouseUp={handleTalkButtonUp}
              onTouchStart={handleTalkButtonDown}
              onTouchEnd={handleTalkButtonUp}
              disabled={!isConnected}
              className={`
                relative w-32 h-32 rounded-full flex items-center justify-center text-white font-semibold text-lg
                transition-all duration-300 ease-out transform
                ${
                  isConnected
                    ? isPTTUserSpeaking
                      ? "bg-red-500 scale-110 shadow-xl ring-4 ring-red-200"
                      : "bg-blue-600 hover:bg-blue-700 hover:scale-105 shadow-lg hover:shadow-xl"
                    : "bg-gray-400 cursor-not-allowed"
                }
                ${isPTTUserSpeaking ? "animate-pulse" : ""}
              `}
            >
              {isPTTUserSpeaking ? (
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 bg-white rounded-full animate-bounce mr-2"
                    style={{ animationDelay: "0s" }}
                  ></div>
                  <div
                    className="w-3 h-3 bg-white rounded-full animate-bounce mr-2"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-3 h-3 bg-white rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              ) : (
                <div className="flex items-center">
                  <svg
                    className={`w-8 h-8 mr-2 transition-transform duration-300 ${
                      isConnected ? "hover:scale-110" : ""
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0019 10a1 1 0 10-2 0A5 5 0 015 10a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span
                    className={`transition-all duration-300 ${
                      isConnected ? "hover:scale-105" : ""
                    }`}
                  >
                    Speak
                  </span>
                </div>
              )}
            </button>
            <div className="mt-4 text-sm text-gray-600">
              {isConnected
                ? isPTTUserSpeaking
                  ? "Listening..."
                  : "Press and hold to speak"
                : "Connect to start speaking"}
            </div>
          </div>
        </div>

        {/* Conversation History */}
        <div className="w-96">
          <Transcript downloadRecording={downloadRecording} />
        </div>
      </div>
    </div>
  );
}

export default App;

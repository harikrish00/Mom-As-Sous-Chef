"use-client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { TranscriptItem } from "@/app/types";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { GuardrailChip } from "./GuardrailChip";

export interface TranscriptProps {
  downloadRecording: () => void;
}

function Transcript({ downloadRecording }: TranscriptProps) {
  const { transcriptItems, toggleTranscriptItemExpand } = useTranscript();
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [prevLogs, setPrevLogs] = useState<TranscriptItem[]>([]);

  function scrollToBottom() {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }

  useEffect(() => {
    const hasNewMessage = transcriptItems.length > prevLogs.length;
    const hasUpdatedMessage = transcriptItems.some((newItem, index) => {
      const oldItem = prevLogs[index];
      return (
        oldItem &&
        (newItem.title !== oldItem.title || newItem.data !== oldItem.data)
      );
    });

    if (hasNewMessage || hasUpdatedMessage) {
      scrollToBottom();
    }

    setPrevLogs(transcriptItems);
  }, [transcriptItems]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl">
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white rounded-t-xl">
        <span className="font-semibold">Conversation</span>
        <button
          onClick={downloadRecording}
          className="text-sm px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 flex items-center justify-center gap-x-1"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span>Download</span>
        </button>
      </div>

      {/* Transcript Content */}
      <div
        ref={transcriptRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-y-4"
      >
        {[...transcriptItems]
          .sort((a, b) => a.createdAtMs - b.createdAtMs)
          .map((item) => {
            const {
              itemId,
              type,
              role,
              data,
              expanded,
              timestamp,
              title = "",
              isHidden,
              guardrailResult,
            } = item;

            if (isHidden) {
              return null;
            }

            if (type === "MESSAGE") {
              const isUser = role === "user";
              const containerClasses = `flex justify-end flex-col ${
                isUser ? "items-end" : "items-start"
              }`;
              const bubbleBase = `max-w-lg p-3 ${
                isUser ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-black"
              }`;
              const isBracketedMessage =
                title.startsWith("[") && title.endsWith("]");
              const messageStyle = isBracketedMessage
                ? "italic text-gray-400"
                : "";
              const displayTitle = isBracketedMessage
                ? title.slice(1, -1)
                : title;

              return (
                <div key={itemId} className={containerClasses}>
                  <div className="max-w-lg">
                    <div
                      className={`${bubbleBase} rounded-t-xl ${
                        guardrailResult ? "" : "rounded-b-xl"
                      }`}
                    >
                      <div
                        className={`text-xs ${
                          isUser ? "text-gray-400" : "text-gray-500"
                        } font-mono`}
                      >
                        {timestamp}
                      </div>
                      <div className={`whitespace-pre-wrap ${messageStyle}`}>
                        <ReactMarkdown>{displayTitle}</ReactMarkdown>
                      </div>
                    </div>
                    {guardrailResult && (
                      <div className="bg-gray-200 px-3 py-2 rounded-b-xl">
                        <GuardrailChip guardrailResult={guardrailResult} />
                      </div>
                    )}
                  </div>
                </div>
              );
            } else if (type === "BREADCRUMB") {
              return (
                <div
                  key={itemId}
                  className="flex flex-col justify-start items-start text-gray-500 text-sm"
                >
                  <span className="text-xs font-mono">{timestamp}</span>
                  <div
                    className={`whitespace-pre-wrap flex items-center font-mono text-sm text-gray-800 ${
                      data ? "cursor-pointer" : ""
                    }`}
                    onClick={() => data && toggleTranscriptItemExpand(itemId)}
                  >
                    {data && (
                      <span
                        className={`text-gray-400 mr-1 transform transition-transform duration-200 select-none font-mono ${
                          expanded ? "rotate-90" : "rotate-0"
                        }`}
                      >
                        ▶
                      </span>
                    )}
                    {title}
                  </div>
                  {expanded && data && (
                    <div className="text-gray-800 text-left">
                      <pre className="border-l-2 ml-1 border-gray-200 whitespace-pre-wrap break-words font-mono text-xs mb-2 mt-2 pl-2">
                        {JSON.stringify(data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            } else {
              // Fallback if type is neither MESSAGE nor BREADCRUMB
              return (
                <div
                  key={itemId}
                  className="flex justify-center text-gray-500 text-sm italic font-mono"
                >
                  Unknown item type: {type}{" "}
                  <span className="ml-2 text-xs">{timestamp}</span>
                </div>
              );
            }
          })}
      </div>
    </div>
  );
}

export default Transcript;

import { useEffect, useRef } from "react";

export default function ChatPageWrapper({
  messages,
  chatInput,
  setChatInput,
  sendMessage,
}) {
  return (
    <div className="flex flex-col h-full">
      <ChatSection
        messages={messages}
        chatInput={chatInput}
        setChatInput={setChatInput}
        sendMessage={sendMessage}
      />
    </div>
  );
}

function ChatSection({ messages, chatInput, setChatInput, sendMessage }) {
  const bottomRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInput = (e) => {
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(200, ta.scrollHeight)}px`;
    setChatInput(ta.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (chatInput.trim()) sendMessage();
    }
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* MESSAGE LIST */}
      <div className="flex-1 overflow-y-auto bg-base-200 p-3 rounded-box space-y-4 shadow-inner">
        {messages.length === 0 ? (
          <div className="text-center text-sm opacity-60 py-6">
            No messages yet — say hi 👋
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender === "me";

            return (
              <div
                key={i}
                className={`chat ${mine ? "chat-end" : "chat-start"}`}
              >
                {/* OPTIONAL name */}
                {m.senderLabel && (
                  <div className="chat-header opacity-70 text-xs mb-1">
                    {m.senderLabel}
                  </div>
                )}

                {/* bubble */}
                <div
                  className={`chat-bubble ${
                    mine ? "chat-bubble-primary" : "chat-bubble-secondary"
                  } whitespace-pre-wrap  text-sm`}
                >
                  {m.text}
                </div>

                {/* footer (timestamp) */}
                {m.ts && (
                  <div className="chat-footer text-[10px] opacity-50 mt-1">
                    {formatTime(m.ts)}
                  </div>
                )}
              </div>
            );
          })
        )}

        <div ref={bottomRef} />
      </div>

      {/* STICKY INPUT AREA */}
      <div className="sticky bottom-0 bg-base-200 pt-3 pb-3">
        <div className="flex gap-2 items-end px-1">

          <textarea
            rows={1}
            value={chatInput}
            onChange={handleInput}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            className="textarea textarea-bordered flex-1 resize-none text-sm min-h-[42px] max-h-[200px]"
          />

          <button
            onClick={() => chatInput.trim() && sendMessage()}
            className="btn btn-primary"
            disabled={!chatInput.trim()}
          >
            Send
          </button>

        </div>
      </div>
    </div>
  );
}

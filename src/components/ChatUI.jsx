export default function ChatUI({
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
  return (
    <div className="flex flex-col h-full">
      
      {/* Messages Area */}
      <div className="flex-1 bg-base-200 rounded-box p-3 overflow-y-auto shadow-inner">
        {messages.map((msg, i) => (
          <div key={i} className={`chat ${msg.sender === "me" ? "chat-end" : "chat-start"}`}>
            <div
              className={`chat-bubble ${
                msg.sender === "me"
                  ? "chat-bubble-primary"
                  : "chat-bubble-secondary"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input + Send Button */}
      <div className="mt-3 flex gap-2">
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="input input-bordered flex-1"
          placeholder="Type a message..."
        />

        <button
          onClick={sendMessage}
          className="btn btn-primary"
        >
          Send
        </button>
      </div>
    </div>
  );
}


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
      <div className="flex-1 bg-gray-100 rounded-lg p-3 overflow-y-auto shadow-inner">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-2 flex ${
              msg.sender === "me" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`px-3 py-2 rounded-lg max-w-xs text-sm ${
                msg.sender === "me"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-300 text-gray-900"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300"
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Send
        </button>
      </div>
    </div>
  );
}
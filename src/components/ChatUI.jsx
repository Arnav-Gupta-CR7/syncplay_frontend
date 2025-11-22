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




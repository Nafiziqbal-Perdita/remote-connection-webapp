import React, { useState, useCallback, useEffect, useRef } from "react";

const Chat = ({
  io,
  otherUser,
  room,
  setAllText,
  allText,
  handleRecieveText,
}) => {
  const [text, setText] = useState("");
  // Refs for the last message element and message container
  const messageContainerRef = useRef(null);

  // Send text to the other user
  const sendText = useCallback(
    (e) => {
      e.preventDefault();

      if (text.trim() === "") {
        return;
      }

      io.current.emit("chat", {
        text: text,
        to: otherUser.current, // Ensure this holds the correct socket ID
      });

      // Corrected: Don't wrap the message in an extra array
      setAllText((prev) => [...prev, { text, author: "me" }]);

      setText(""); // Clear the input after sending
    },
    [text, io, otherUser] // Dependencies on io and otherUser
  );

  useEffect(() => {
    handleRecieveText("");
    // console.log("Function Called");
  }, [io, handleRecieveText]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop =
        messageContainerRef.current.scrollHeight;
    }
  }, [allText]);

  return (
    <>
      <div
        className="basis-11/12 overflow-y-auto p-4 flex flex-col space-y-2 "
        ref={messageContainerRef}
      >
        {/* <div className="flex justify-end">
          <div className="bg-blue-200 text-black p-2 rounded-lg max-w-xs">
            Hey, how's your day going?
          </div>
        </div> */}

        {/* Example Received Message */}
        {/* <div className="flex">
          <div className="bg-gray-300 text-black p-2 rounded-lg max-w-xs">
            Not too bad, just a bit busy. How about you?
          </div>
        </div> */}

        {allText.map((message, id) => {
          // Skip rendering if the message is from the system
          if (message.author === "system") {
            return null; // Do not render system messages
          }

          return (
            <div
              key={id}
              className={`flex ${
                message.author === "you" ? "justify-start" : "justify-end"
              }`}
            >
              <div
                className={`${
                  message.author === "you"
                    ? "bg-amber-400 opacity-95"
                    : "bg-gray-300"
                } text-black p-2 rounded-lg max-w-xs`}
              >
                {message.text} <br />
                <small>{`${message.author==="you"?"":""}`}</small>
                </div>
              </div>
          );
        })}
      </div>

      <div className="bg-white p-4 flex items-center">
        <form onSubmit={sendText} className="flex w-full">
          {" "}
          {/* Corrected 'from' to 'form' */}
          <input
            type="text"
            placeholder="Type your message..."
            className="flex-1 border rounded-full px-4 py-2 focus:outline-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="submit" // Changed to submit since it's inside a form
            className="bg-amber-700 opacity-90 text-white rounded-full p-2 ml-2 hover:bg-amber-800 focus:outline-none"
          >
            <svg
              width="20px"
              height="20px"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              stroke="#ffffff"
            >
              <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
              <g
                id="SVGRepo_tracerCarrier"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></g>
              <g id="SVGRepo_iconCarrier">
                <path
                  d="M11.5003 12H5.41872M5.24634 12.7972L4.24158 15.7986C3.69128 17.4424 3.41613 18.2643 3.61359 18.7704C3.78506 19.21 4.15335 19.5432 4.6078 19.6701C5.13111 19.8161 5.92151 19.4604 7.50231 18.7491L17.6367 14.1886C19.1797 13.4942 19.9512 13.1471 20.1896 12.6648C20.3968 12.2458 20.3968 11.7541 20.1896 11.3351C19.9512 10.8529 19.1797 10.5057 17.6367 9.81135L7.48483 5.24303C5.90879 4.53382 5.12078 4.17921 4.59799 4.32468C4.14397 4.45101 3.77572 4.78336 3.60365 5.22209C3.40551 5.72728 3.67772 6.54741 4.22215 8.18767L5.24829 11.2793C5.34179 11.561 5.38855 11.7019 5.407 11.8459C5.42338 11.9738 5.42321 12.1032 5.40651 12.231C5.38768 12.375 5.34057 12.5157 5.24634 12.7972Z"
                  stroke="#ffffff"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></path>{" "}
              </g>
            </svg>
          </button>
        </form>
      </div>
    </>
  );
};

export default Chat;

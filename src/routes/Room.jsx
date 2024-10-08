import Peer from "peerjs";
import { connect, io } from "socket.io-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerAction,
  Spinner,
} from "keep-react";
import {
  Microphone,
  MicrophoneSlash,
  Camera,
  CameraSlash,
  Monitor,
  Phone,
  ChatCircleDots,
  VideoCamera,
  CaretLeft,
  Copy,
} from "phosphor-react";
import { Tooltip } from "@radix-ui/themes";
import Chat from "./Chat";

const Room = () => {
  const { roomID } = useParams();
  const socketRef = useRef(null);
  // const socketRef=useSocket();
  const remoteUserSocketId = useRef(null);
  const myPeerId = useRef(null);
  const remotePeerId = useRef(null);
  const peerRef = useRef(null);
  const myVideo = useRef(null);
  const remoteVideo = useRef(null);
  const userStream = useRef(null); // Store local stream (camera)
  const senders = useRef([]); // Store the RTCRtpSenders for video/audio tracks
  const [allText, setAllText] = useState([]);
  const [codeCopy, setCodeCopy] = useState(false);
  const [myVideoShow, setMyVideoShow] = useState(true);
  const [socketState, setSocketState] = useState(null);
  const [loader, setLoader] = useState(true);
  const navigate = useNavigate();
  const establishConnection = useCallback((peerId) => {
    // console.log("Remote user is", remoteUserSocketId.current);

    const getUserMedia =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia;

    getUserMedia(
      { video: true, audio: true },
      (stream) => {
        userStream.current = stream;
        myVideo.current.srcObject = stream;

        const call = peerRef.current.call(peerId, stream);
        senders.current = call.peerConnection.getSenders(); // Store the senders

        call.on("stream", (remoteStream) => {
          remoteVideo.current.srcObject = remoteStream;
        });
      },
      (err) => {
        console.log("Failed to get local stream", err);
      }
    );
  }, []);

  const shareScreen = useCallback(() => {
    navigator.mediaDevices
      .getDisplayMedia({ cursor: true })
      .then((stream) => {
        const screenTrack = stream.getTracks()[0];
        const videoSender = senders.current.find(
          (sender) => sender.track.kind === "video"
        );

        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        } else {
          console.error("No video sender found to replace track");
        }

        // Revert to the original video track when screen sharing ends
        screenTrack.onended = () => {
          const originalVideoTrack = userStream.current
            .getTracks()
            .find((track) => track.kind === "video");
          if (videoSender && originalVideoTrack) {
            videoSender.replaceTrack(originalVideoTrack);
          }
        };
      })
      .catch((error) => console.error("Error sharing screen: ", error));
  }, [senders]);
  // Handle Text Message

  const handleRecieveText = useCallback(
    ({ text }) => {
      // console.log("Message received:", text); // Log the received text

      // Check if the text is defined and not an empty string
      if (text === undefined || text.trim() === "") {
        console.log("No valid message received");
        // Optionally, you might want to handle the case of invalid messages differently
        setAllText((prev) => [
          ...prev,
          { text: "No message", author: "system" },
        ]);
      } else {
        // console.log("Valid message received:", text);
        setAllText((prev) => [...prev, { text, author: "you" }]);
      }
    },
    [setAllText]
  );

  useEffect(() => {
    // peerRef.current = new Peer();
    
    
     peerRef.current = new Peer({
      config: {
        iceServers: [{ url: "stun:stun.l.google.com:19302" }],
      } /* Sample servers, please use appropriate ones */,
    });



    peerRef.current.on("open", (id) => {
      myPeerId.current = id;
      console.log("My peer id is", myPeerId.current);
      const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;
      // console.log("Socket url",SOCKET_URL); // Should print the correct URL

      socketRef.current = io(SOCKET_URL, {
        withCredentials: true,
        transports: ["websocket", "polling"],
      });
      // setSocketState(socketRef.current);

      socketRef.current.on("connect", () => {
        // console.log("Socket connected with ID: ", socketRef.current.id);
      });

      socketRef.current.emit("join room", roomID);
      // console.log("User joined room:", roomID);
      setLoader(false);
      socketRef.current.on("user joined", (userId) => {
        remoteUserSocketId.current = userId;
      });

      socketRef.current.on("other user", (userId) => {
        remoteUserSocketId.current = userId;
        socketRef.current.emit("getPeerId", {
          to: userId,
          peerId: myPeerId.current,
        });
      });
      // socketRef.current.on("room full", ({ message }) => {
      //   alert(message);
      //   navigate("/");
      // });

      socketRef.current.on("takePeerId", (peerId) => {
        // console.log("Remote peer id is", peerId);
        remotePeerId.current = peerId;
        establishConnection(peerId);
      });

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect(); // Disconnect the socket
        }
      };
    });

    peerRef.current.on("call", (call) => {
      const getUserMedia =
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia;

      getUserMedia(
        { video: true, audio: true },
        (stream) => {
          userStream.current = stream;
          myVideo.current.srcObject = stream;

          call.answer(stream);
          senders.current = call.peerConnection.getSenders(); // Store the senders

          call.on("stream", (remoteStream) => {
            remoteVideo.current.srcObject = remoteStream;
          });
        },
        (err) => {
          console.log("Failed to get local stream", err);
        }
      );
    });
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    // console.log("This is the second useEffect");
    if (socketRef.current) {
      // console.log("Here the code entered");
      socketRef.current.on("recieveChat", handleRecieveText);

      // Cleanup function to remove the listener when the component unmounts or socketRef changes
      return () => {
        socketRef.current.off("recieveChat", handleRecieveText);
      };
    }
  }, [socketRef.current, handleRecieveText]);

  const leaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    navigate("/");
  };

  const copyToClipBoard = async (e) => {
    e.preventDefault();
    setCodeCopy(true);
    await navigator.clipboard.writeText(roomID);
    setCodeCopy(false);
  };

  if (loader) {
    return (
      <>
        <div className="bg-black h-screen opacity-75 flex items-center justify-center">
          <div className="bg-gray-800 p-2 h-16 w-36 flex items-center justify-center gap-2 rounded-lg shadow-md ">
            <Spinner color="success" size="lg" />
            <span className="text-white">Processing....</span>
          </div>
        </div>
      </>
    );
  } else {
    return (
      <>
        <div className="bg-black opacity-90 h-screen grid grid-rows-1   ">
          {/* main body  */}
          {/* here the user joined notification will show  */}

          <div className=" relative  basis-11/12">
            {/* this is remote video stream */}

            <div className="h-full w-full  max-w-full flex  ">
              <video
                id="remotevideo"
                className=" w-full "
                ref={remoteVideo}
                autoPlay
              />
            </div>

            <div className="h-56 w-56 p-1 shadow-md absolute right-3 top-5 flex flex-col  ">
              {/*user video */}

              <div
                className={`bg-transparent flex-1 ${
                  myVideoShow ? "" : "hidden"
                } `}
              >
                {/* user video  */}

                <div className="w-full h-full relative">
                  <video className="w-full h-full" ref={myVideo} autoPlay />
                </div>
              </div>
            </div>
          </div>
          {/* footer part  */}
          <div className="relative basis-1/12 bg-gray-950  h-14 mb-2 px-3 py-2 shadow-md flex justify-between items-center   opacity-90  ">
            {/* this is Control section */}

            <div className=" text-white  flex items-center justify-evenly gap-2 ">
              <div>
                <span>Room Code: </span>
                <span className="bg-slate-800 px-2 py-1 rounded-md shadow-md">
                  {roomID}
                </span>
              </div>
              <div className="relative">
                <span
                  className={`bg-slate-700 px-2 py-1 rounded-md absolute -translate-y-10 translate-x-2 ${
                    codeCopy ? "" : "hidden"
                  } `}
                >
                  Copied
                </span>

                <Button
                  shape="icon"
                  size="sm"
                  className="bg-transparent -translate-y-1 -translate-x-1 hover:bg-slate-500 hover:opacity-90 hover:font-bold  hover:delay-150 hover:duration-150  "
                  onClick={(e) => copyToClipBoard(e)}
                >
                  <Copy size={22} />
                </Button>
              </div>
            </div>
            <div className="bg-white  absolute  top-0 -translate-y-1/4 left-1/2 -translate-x-1/2  flex gap-2 px-2 py-1 rounded-md shadow-md  ">
              {/* <div>
        <Tooltip
          content="Mic"
          className="text-black px-2 py-1 rounded-lg bg-white opacity-85"
        >
          <Button
            shape="icon"
            className="rounded-xl bg-black opacity-85"
            onClick={() => setVoice((prev) => !prev)}
          >
            {voice ? <Microphone /> : <MicrophoneSlash />}
          </Button>
        </Tooltip>
      </div> */}

              {/* <div>
        <Tooltip
          content="Camera"
          className="text-black px-2 py-1 rounded-lg bg-white opacity-85"
        >
          <Button
            shape="icon"
            className="rounded-xl bg-black opacity-85"
            onClick={() => setVideo((prev) => !prev)}
          >
            {voice ? <Camera /> : <CameraSlash />}
          </Button>
        </Tooltip>
      </div> */}

              <div>
                <Tooltip
                  content="Share Screen"
                  className="text-black px-2 py-1 rounded-lg bg-white opacity-85"
                >
                  <Button
                    shape="icon"
                    className="rounded-xl bg-black opacity-85 hover:scale-105 hover:duration-500 hover:bg-black hover:text-white hover:-translate-y-1 "
                    onClick={shareScreen}
                  >
                    <Monitor />
                  </Button>
                </Tooltip>
              </div>
              <div>
                <Tooltip
                  content="Leave"
                  className="text-black px-2 py-1 rounded-lg bg-white opacity-85 "
                >
                  <Button
                    shape="icon"
                    className="rounded-xl bg-red-600 opacity-95 hover:-translate-y-1 hover:bg-red-600 hover:text-black"
                    onClick={leaveRoom}
                  >
                    <Phone />
                  </Button>
                </Tooltip>
              </div>
            </div>
            <div className="flex justify-center items-center gap-4">
              <div className="">
                {/* video show modal button  */}
                <Button
                  className="bg-amber-800  opacity-80 rounded-md hover:scale-105 hover:duration-500 hover:bg-amber-500 hover:text-black hover:-translate-y-2  "
                  onClick={() => setMyVideoShow((prev) => !prev)}
                >
                  {myVideoShow ? (
                    <VideoCamera className="" size={23} />
                  ) : (
                    <CameraSlash size={23} />
                  )}
                </Button>
              </div>

              <div>
                {/* this is message Drawer */}

                <Drawer position="left">
                  <DrawerAction asChild>
                    <Button
                      shape="icon"
                      size="lg"
                      className="bg-amber-800 opacity-80 rounded-full hover:scale-105 hover:duration-500 hover:bg-amber-500 hover:text-black hover:-translate-y-2 "
                    >
                      <ChatCircleDots size={30} />
                    </Button>
                  </DrawerAction>
                  <DrawerContent className="">
                    <div className="h-screen flex flex-col bg-gray-100">
                      <div className="bg-yellow-500 font-semibold opacity-90 basis-1/12 ">
                        <DrawerClose className="absolute right-5 top-5" />

                        <div className="absolute left-1/2 -translate-x-1/2 top-5 flex flex-col ">
                          <h6 className="text-body-2">Inbox</h6>
                        </div>
                      </div>

                      {/* chat function  */}
                      <Chat
                        io={socketRef}
                        otherUser={remoteUserSocketId}
                        room={roomID}
                        setAllText={setAllText}
                        allText={allText}
                        handleRecieveText={handleRecieveText}
                      />
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
};

export default Room;

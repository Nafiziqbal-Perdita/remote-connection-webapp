import React, { useRef, useEffect, useCallback, useState } from "react";
import io from "socket.io-client";
import { useParams, useNavigate } from "react-router-dom";
import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerAction,
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
  const userVideo = useRef();
  const partnerVideo = useRef();
  const peerRef = useRef();
  const socketRef = useRef();
  const otherUser = useRef();
  const userStream = useRef();
  const myId = useRef();
  const senders = useRef([]);
  const [allText, setAllText] = useState([]);
  const [video, setVideo] = useState(true);
  const [voice, setVoice] = useState(true);
  const [myVideo, setMyVideo] = useState(true);
  const [codeCopy, setCodeCopy] = useState(false);
  const navigate = useNavigate();

  // Handle ICE Candidate Event
  const handleICECandidateEvent = useCallback(
    (e) => {
      if (e.candidate) {
        const payload = {
          target: otherUser.current,
          candidate: e.candidate,
        };
        socketRef.current.emit("ice-candidate", payload);
      }
    },
    [socketRef]
  );

  // Handle Track Event
  const handleTrackEvent = useCallback(
    (e) => {
      partnerVideo.current.srcObject = e.streams[0];
    },
    [partnerVideo]
  );

  // Handle Negotiation Needed Event
  const handleNegotiationNeededEvent = useCallback(
    (userId) => {
      peerRef.current
        .createOffer()
        .then((offer) => peerRef.current.setLocalDescription(offer))
        .then(() => {
          const payload = {
            target: userId,
            caller: socketRef.current.id,
            sdp: peerRef.current.localDescription,
          };
          socketRef.current.emit("offer", payload);
        })
        .catch((e) => console.log(e));
    },
    [peerRef, socketRef]
  );

  // Create Peer Function
  const createPeer = useCallback(
    (userId) => {
      // const peer = new RTCPeerConnection({
      //   iceServers: [
      //     { urls: "stun:stun.stunprotocol.org" },
      //     {
      //       urls: "turn:numb.viagenie.ca",
      //       credential: "muazkh",
      //       username: "webrtc@live.com",
      //     },
      //   ],
      // });

      const peer = new RTCPeerConnection({
        iceServers: [
          {
            urls: "stun:stun.l.google.com:19302", // Google's STUN server
          },

          {
            urls: "turn:192.158.29.39:3478?transport=udp", // TURN server with UDP transport
            credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
            username: "28224511:1379330808",
          },
          {
            urls: "turn:192.158.29.39:3478?transport=tcp", // TURN server with TCP transport
            credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
            username: "28224511:1379330808",
          },
          {
            urls: "stun:stun.stunprotocol.org", // Generic STUN server
          },

          {
            urls: "turn:numb.viagenie.ca", // Public TURN server
            credential: "muazkh",
            username: "webrtc@live.com",
          },
        ],
      });

      peer.onicecandidate = handleICECandidateEvent;
      peer.ontrack = handleTrackEvent;
      peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userId);

      return peer;
    },
    [handleICECandidateEvent, handleTrackEvent, handleNegotiationNeededEvent]
  );

  // Call User Function
  const callUser = useCallback(
    (userId) => {
      peerRef.current = createPeer(userId);
      userStream.current.getTracks().forEach((track) => {
        // console.log("user Tracks", track); // This will help to ensure tracks are being sent
        senders.current.push(
          peerRef.current.addTrack(track, userStream.current)
        );
      });
    },
    [createPeer]
  );

  // Handle Answer Function
  const handleAnswer = useCallback(
    async (message) => {
      const desc = await new RTCSessionDescription(message.sdp);
      peerRef.current.setRemoteDescription(desc).catch((e) => console.log(e));
    },
    [peerRef]
  );

  // Handle Receive Call Function

  const handleRecieveCall = useCallback(
    async (incoming) => {
      // first it will also connect a peer from own perspective
      peerRef.current = await createPeer();
      const desc = await new RTCSessionDescription(incoming.sdp);

      // Set the remote description for the peer connection
      peerRef.current
        .setRemoteDescription(desc)
        .then(() => {
          // Add tracks to the peer connection
          userStream.current.getTracks().forEach((track) => {
            // Add tracks and push them to the `senders` array
            senders.current.push(
              peerRef.current.addTrack(track, userStream.current)
            );
          });
        })
        .then(() => peerRef.current.createAnswer())
        .then((answer) => peerRef.current.setLocalDescription(answer))
        .then(() => {
          const payload = {
            target: incoming.caller,
            caller: socketRef.current.id,
            sdp: peerRef.current.localDescription,
          };
          socketRef.current.emit("answer", payload);
        })
        .catch((e) => console.log(e));
    },
    [createPeer, socketRef, senders]
  );

  // Handle New ICE Candidate Message
  const handleNewICECandidateMsg = useCallback(
    (incoming) => {
      const candidate = new RTCIceCandidate(incoming);
      peerRef.current.addIceCandidate(candidate).catch((e) => console.log(e));
    },
    [peerRef]
  );

  const shareScreen = useCallback(() => {
    navigator.mediaDevices
      .getDisplayMedia({ cursor: true })
      .then((stream) => {
        const screenTrack = stream.getTracks()[0];

        // Find the video sender
        const videoSender = senders.current.find(
          (sender) => sender.track.kind === "video"
        );

        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        } else {
          console.error("No video sender found to replace track");
        }

        // When the screen sharing stops, revert to the original video track
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
  }, [senders, userStream]);

  // Handle Text Message
  const handleRecieveText = useCallback(
    ({ text }) => {
      setAllText((prev) => [...prev, { text, author: "you" }]);
    },
    [setAllText]
  );

  // Component Mounting: Setting up media and socket connection
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: {
          width: {
            min: 640,
            max: 1920,
            ideal: 1280,
          },
          height: {
            min: 480,
            max: 1080,
            ideal: 720,
          },
          facingMode: "user", //this is for fron camera for back camera user "environment"
        },
      })
      .then((stream) => {
        userVideo.current.srcObject = stream;
        userStream.current = stream;
        const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;
        // console.log("Socket url",SOCKET_URL); // Should print the correct URL

        socketRef.current = io(SOCKET_URL, {
          withCredentials: true,
          transports: ["websocket", "polling"],
        });

        socketRef.current.emit("join room", roomID);

        socketRef.current.on("user joined", (userId) => {
          otherUser.current = userId;
          // console.log("A User Has Joined", otherUser.current);
        });
        socketRef.current.on("other user", (userId) => {
          otherUser.current = userId;
          // console.log("A User Has Joined", otherUser.current);
          callUser(userId);
        });

        socketRef.current.on("room full", ({ message }) => {
          alert(message);
          navigate("/");
        });

        socketRef.current.on("answer", handleAnswer);
        socketRef.current.on("offer", handleRecieveCall);
        socketRef.current.on("recieveChat", handleRecieveText);
        socketRef.current.on("ice-candidate", handleNewICECandidateMsg);
      });

    return () => {
      socketRef.current.disconnect();
      socketRef.current.off("answer", handleAnswer);
      socketRef.current.off("offer", handleRecieveCall);
      socketRef.current.off("recieveChat", handleRecieveText);
      socketRef.current.off("ice-candidate", handleNewICECandidateMsg);
    };
  }, [
    socketRef,
    roomID,
    callUser,
    handleAnswer,
    handleRecieveCall,
    handleRecieveText,
    handleNewICECandidateMsg,
  ]);

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

  // console.log(senders.current);

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
              ref={partnerVideo}
              autoPlay
            />
          </div>

          <div className="h-40 w-40 sm:h-56 sm:w-56 p-1  absolute right-3 top-5 flex flex-col  ">
            {/*user video */}

            <div
              className={`bg-transparent flex-1 ${myVideo ? "" : "hidden"} `}
            >
              {/* user video  */}

              <div className="w-full h-full relative">
                <video className="w-full h-full" ref={userVideo} autoPlay />
              </div>
            </div>
          </div>
        </div>
        {/* footer part  */}
        <div className="relative basis-1/12 bg-gray-950  h-14 mb-2 px-3 py-2 shadow-md flex justify-between items-center   opacity-90  ">
          {/* this is Control section */}

          <div className=" text-white  flex items-center justify-evenly gap-2 ">
            <div>
              <span className="hidden sm:inline ">Room Code: </span>
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
                onClick={() => setMyVideo((prev) => !prev)}
              >
                {myVideo ? (
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
                    <div className="bg-amber-800 text-white opacity-95 font-semibold  basis-1/12 ">
                      <DrawerClose className="absolute bg-white rounded-full hover:opacity-90 hover:-translate-y-0.5 hover:duration-300 right-5 top-5" />

                      <div className="absolute left-1/2 -translate-x-1/2 top-5 flex flex-col ">
                        <h6 className="text-body-2">Inbox</h6>
                      </div>
                    </div>

                    {/* chat function  */}
                    <Chat
                      io={socketRef}
                      otherUser={otherUser}
                      room={roomID}
                      setAllText={setAllText}
                      allText={allText}
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
};

export default Room;

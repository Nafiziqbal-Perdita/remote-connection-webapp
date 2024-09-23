import React from 'react';
import { BrowserRouter, Route, Routes } from "react-router-dom";
import CreateRoom from "./routes/CreateRoom.jsx";
import Room from "./routes/Room.jsx";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CreateRoom />} />
          <Route path="/room/:roomID" element={<Room />} />

        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
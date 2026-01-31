import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ChakraProvider, ColorModeScript, useColorMode } from "@chakra-ui/react";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import HintGenerator from "./pages/HintGenerator";
import theme from "./theme";

function ColorModeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();
  return (
    <button
      onClick={toggleColorMode}
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '8px 16px',
        borderRadius: '4px',
        background: colorMode === 'light' ? 'gray.800' : 'white',
        color: colorMode === 'light' ? 'white' : 'gray.800',
        border: 'none',
        cursor: 'pointer',
        zIndex: 1000
      }}
    >
      {colorMode === 'light' ? '🌙' : '☀️'}
    </button>
  );
}

export default function App() {
  const [user, setUser] = useState(null);

  return (
    <ChakraProvider theme={theme}>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <Router>
        <ColorModeToggle />
        <Routes>
          <Route path="/" element={<Login setUser={setUser} />} />
          <Route path="/signup" element={<SignUp setUser={setUser} />} />
          <Route
            path="/hint"
            element={user ? <HintGenerator user={user} setUser={setUser} /> : <Navigate to="/" />}
          />
        </Routes>
      </Router>
    </ChakraProvider>
  );
} 
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  VStack,
  Text,
  Button,
  Container,
  Heading,
  Textarea,
  useToast,
  useColorMode,
  Center,
  Spinner,
  Divider
} from "@chakra-ui/react";
import "./HintGenerator.css";

export default function HintGenerator({ user, setUser }) {
  const [question, setQuestion] = useState("");
  const [code, setCode] = useState("");
  const [hints, setHints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDirectAnswerOption, setShowDirectAnswerOption] = useState(false);
  const [directAnswer, setDirectAnswer] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { colorMode } = useColorMode();

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  useEffect(() => {
    // Reset hints and direct answer option when question changes
    setHints([]);
    setShowDirectAnswerOption(false);
    setDirectAnswer(null);
  }, [question]);

  const logout = () => {
    setUser(null);
    navigate("/login");
  };

  const getHint = async (wantDirectAnswer = false) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("http://13.49.139.136:5000/api/get_hint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: user.username,
          question,
          code_context: code,
          hint_number: hints.length + 1,
          want_direct_answer: wantDirectAnswer,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get hint");
      }

      if (wantDirectAnswer) {
        setDirectAnswer(data.hint);
      } else {
        setHints([...hints, data.hint]);
        // Show direct answer option after 3 hints
        if (hints.length + 1 >= 3) {
          setShowDirectAnswerOption(true);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatHintText = (text) => {
    // Handle potential undefined or null text
    if (!text) return null;
    // Split the text into lines and wrap each in a paragraph or use <br /> for line breaks
    return text.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        <br />
      </React.Fragment>
    ));
  };

  return (
    <Container maxW="container.xl" py={8}>
      <Box className="hint-generator">
        <Box className="header">
          <Heading 
            size="xl" 
            bgGradient="linear(to-r, purple.500, purple.300)" 
            bgClip="text"
          >
            Symbi.ai
          </Heading>
          <Button
            onClick={logout}
            colorScheme="red"
            variant="outline"
            className="logout-button"
          >
            Logout
          </Button>
        </Box>

        <Box className="input-section">
          <Box>
            <Text mb={2} color={colorMode === "dark" ? "gray.200" : "gray.700"}>Your Question</Text>
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Enter your programming question here..."
              className="question-input"
              bg={colorMode === "dark" ? "gray.700" : "white"}
              color={colorMode === "dark" ? "white" : "gray.800"}
              borderColor={colorMode === "dark" ? "gray.500" : "gray.200"}
            />
          </Box>
          <Box>
            <Text mb={2} color={colorMode === "dark" ? "gray.200" : "gray.700"}>Your Code</Text>
            <Textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your code here (optional)..."
              className="code-input"
              bg={colorMode === "dark" ? "gray.700" : "white"}
              color={colorMode === "dark" ? "white" : "gray.800"}
              borderColor={colorMode === "dark" ? "gray.500" : "gray.200"}
            />
          </Box>
        </Box>

        {error && (
          <Text color="red.500" className="error-message">
            {error}
          </Text>
        )}

        <Center gap={4} mb={8}>
          <Button
            onClick={() => getHint(false)}
            isLoading={loading}
            loadingText="Getting Hint..."
            className="get-hint-button"
            isDisabled={!question}
            colorScheme="purple"
          >
            Get Hint
          </Button>
        </Center>

        <Box className="hints-section">
          {hints.map((hint, index) => (
            <Box
              key={index}
              className="hint-card"
              bg={colorMode === "dark" ? "gray.700" : "white"}
              borderColor={colorMode === "dark" ? "gray.500" : "gray.200"}
            >
              <Heading size="md" color={colorMode === "dark" ? "purple.300" : "purple.500"}>
                Hint {index + 1}
              </Heading>
              <Text className="hint-content" color={colorMode === "dark" ? "gray.200" : "gray.700"}>
                {formatHintText(hint)}
              </Text>
            </Box>
          ))}

          {showDirectAnswerOption && !directAnswer && (
            <Center mt={4}>
              <Button
                onClick={() => getHint(true)}
                isLoading={loading}
                loadingText="Getting Answer..."
                className="direct-answer-button"
                colorScheme="green"
              >
                Get Direct Answer
              </Button>
            </Center>
          )}

          {directAnswer && (
            <Box
              className="direct-answer-card"
              bg={colorMode === "dark" ? "gray.700" : "white"}
              borderColor={colorMode === "dark" ? "gray.500" : "gray.200"}
            >
              <Heading size="md" color={colorMode === "dark" ? "purple.300" : "purple.500"}>
                Direct Answer
              </Heading>
              <Text className="direct-answer-content" color={colorMode === "dark" ? "gray.200" : "gray.700"}>
                {formatHintText(directAnswer)}
              </Text>
            </Box>
          )}
        </Box>
      </Box>
    </Container>
  );
}
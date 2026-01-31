import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  VStack,
  Text,
  Input,
  Button,
  Container,
  Heading,
  FormControl,
  FormLabel,
  useToast,
  Center,
  useColorMode
} from "@chakra-ui/react";
import axios from 'axios';

export default function SignUp({ setUser }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const { colorMode } = useColorMode();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !email || !password || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/register', {
        username,
        email,
        password
      });

      if (response.data.success) {
        setUser(username);
        toast({
          title: "Registration Successful",
          description: "Welcome to Symbi.ai! A welcome email has been sent to your inbox.",
          status: "success",
          duration: 5000,
          isClosable: true,
        });
        navigate('/hint');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Something went wrong",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxW="container.sm" py={8}>
      <Center flexDirection="column" gap={6}>
        <Heading 
          size="xl" 
          bgGradient="linear(to-r, purple.500, purple.300)" 
          bgClip="text"
        >
          Symbi.ai
        </Heading>
        <Text color={colorMode === "dark" ? "gray.300" : "gray.500"}>Create Your Account</Text>

        <Box 
          w="100%" 
          maxW="400px" 
          p={6} 
          borderRadius="lg" 
          borderWidth="1px" 
          boxShadow={colorMode === "dark" ? "dark-lg" : "lg"}
          bg={colorMode === "dark" ? "gray.700" : "white"}
        >
          <form onSubmit={handleSubmit}>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel color={colorMode === "dark" ? "gray.200" : "gray.700"}>Username</FormLabel>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  bg={colorMode === "dark" ? "gray.600" : "white"}
                  color={colorMode === "dark" ? "white" : "gray.800"}
                  borderColor={colorMode === "dark" ? "gray.500" : "gray.200"}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel color={colorMode === "dark" ? "gray.200" : "gray.700"}>Email</FormLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  bg={colorMode === "dark" ? "gray.600" : "white"}
                  color={colorMode === "dark" ? "white" : "gray.800"}
                  borderColor={colorMode === "dark" ? "gray.500" : "gray.200"}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel color={colorMode === "dark" ? "gray.200" : "gray.700"}>Password</FormLabel>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  bg={colorMode === "dark" ? "gray.600" : "white"}
                  color={colorMode === "dark" ? "white" : "gray.800"}
                  borderColor={colorMode === "dark" ? "gray.500" : "gray.200"}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel color={colorMode === "dark" ? "gray.200" : "gray.700"}>Confirm Password</FormLabel>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  bg={colorMode === "dark" ? "gray.600" : "white"}
                  color={colorMode === "dark" ? "white" : "gray.800"}
                  borderColor={colorMode === "dark" ? "gray.500" : "gray.200"}
                />
              </FormControl>

              <Button
                type="submit"
                colorScheme="purple"
                width="100%"
                isLoading={loading}
                loadingText="Creating Account..."
              >
                Sign Up
              </Button>

              <Button
                variant="link"
                onClick={() => navigate('/')}
                color="purple.500"
              >
                Already have an account? Login
              </Button>
            </VStack>
          </form>
        </Box>
      </Center>
    </Container>
  );
} 
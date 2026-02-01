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

export default function Login({ setUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const { colorMode } = useColorMode();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
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

    setLoading(true);
    try {
      const response = await axios.post('http://13.49.139.136:5000/login', {
        email,
        password
      });

      if (response.data.success) {
        setUser(response.data.username);
        toast({
          title: "Login Successful",
          description: "Welcome back!",
          status: "success",
          duration: 2000,
          isClosable: true,
        });
        navigate('/hint');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Invalid credentials",
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
        <Text color={colorMode === "dark" ? "gray.300" : "gray.500"}>Your AI Programming Assistant</Text>

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

              <Button
                type="submit"
                colorScheme="purple"
                width="100%"
                isLoading={loading}
                loadingText="Logging in..."
              >
                Login
              </Button>

              <Button
                variant="link"
                onClick={() => navigate('/signup')}
                color="purple.500"
              >
                Don't have an account? Sign Up
              </Button>
            </VStack>
          </form>
        </Box>
      </Center>
    </Container>
  );
} 
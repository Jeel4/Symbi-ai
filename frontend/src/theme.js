import { extendTheme } from "@chakra-ui/react";

const config = {
  initialColorMode: "light",
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  styles: {
    global: (props) => ({
      body: {
        bg: props.colorMode === "dark" ? "gray.800" : "gray.50",
        color: props.colorMode === "dark" ? "white" : "gray.800",
      },
    }),
  },
  components: {
    Button: {
      baseStyle: (props) => ({
        _hover: {
          bg: props.colorMode === "dark" ? "purple.400" : "purple.500",
        },
      }),
    },
    Container: {
      baseStyle: (props) => ({
        bg: props.colorMode === "dark" ? "gray.700" : "white",
        boxShadow: props.colorMode === "dark" ? "dark-lg" : "lg",
      }),
    },
  },
});

export default theme; 
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import App from './App';

const theme = extendTheme({
  styles: {
    global: {
      body: {
        bg: 'gray.50',
      },
    },
  },
  colors: {
    purple: {
      50: '#f6e8ff',
      100: '#e3bdff',
      200: '#cd94ff',
      300: '#b46ef7',
      400: '#9a4ce7',
      500: '#7e31ce',
      600: '#62259f',
      700: '#461a71',
      800: '#2b1044',
      900: '#130519',
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <App />
    </ChakraProvider>
  </React.StrictMode>
); 
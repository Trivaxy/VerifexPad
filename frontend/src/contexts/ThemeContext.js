import React, { createContext, useState, useContext, useEffect } from 'react';

// Theme configurations
export const themes = {
  dark: {
    name: 'dark',
    colors: {
      background: '#1e1e1e',
      surface: '#252526',
      primary: '#0e639c',
      primaryHover: '#1177bb',
      secondary: '#414141',
      secondaryHover: '#525252',
      accent: '#6a329f',
      accentHover: '#7c4dba',
      border: '#333',
      text: '#d4d4d4',
      success: '#89d185',
      error: '#f48771',
      codeBackground: '#161616',
    },
    editorTheme: 'vs-dark',
  },
  light: {
    name: 'light',
    colors: {
      background: '#ffffff',
      surface: '#f3f3f3',
      primary: '#0078d4',
      primaryHover: '#106ebe',
      secondary: '#dddddd',
      secondaryHover: '#c8c8c8',
      accent: '#8a2be2',
      accentHover: '#9b4ddb',
      border: '#ccc',
      text: '#333333',
      success: '#107c10',
      error: '#d83b01',
      codeBackground: '#f5f5f5',
    },
    editorTheme: 'vs',
  }
};

// Create context
export const ThemeContext = createContext({
  theme: themes.dark,
  toggleTheme: () => {},
});

// Create provider
export const ThemeProvider = ({ children }) => {
  // Check if theme preference is stored in localStorage
  const getInitialTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'light' ? themes.light : themes.dark;
  };

  const [theme, setTheme] = useState(getInitialTheme);

  // Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme(prevTheme => 
      prevTheme.name === 'dark' ? themes.light : themes.dark
    );
  };

  // Save theme preference to localStorage
  useEffect(() => {
    localStorage.setItem('theme', theme.name);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook for using theme
export const useTheme = () => useContext(ThemeContext);
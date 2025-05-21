import React, { useState, useEffect } from 'react';
import SplitPane from 'split-pane-react/esm/SplitPane';
import styled from 'styled-components';
import 'split-pane-react/esm/themes/default.css';
import CodeEditor from './components/CodeEditor';
import OutputPanel from './components/OutputPanel';
import ControlPanel from './components/ControlPanel';
import Reference from './components/Reference';
import api from './services/api';
import examples from './examples/examples';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

const AppContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
`;

const ContentContainer = styled.div`
  flex: 1;
  overflow: hidden;
`;

function AppContent() {
  const [code, setCode] = useState(examples[0].code);
  const [result, setResult] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [sizes, setSizes] = useState(['60%', '40%']);
  const [showReference, setShowReference] = useState(false);
  const { theme } = useTheme();

  const runCode = async () => {
    setIsRunning(true);
    setResult({ output: 'Running...' });

    try {
      const response = await api.compileAndRun(code);
      setResult(response);
    } catch (error) {
      setResult({
        success: false,
        error: 'Error: Failed to communicate with the server',
        output: ''
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
  };

  const toggleReference = () => {
    setShowReference(!showReference);
  };

  // Add dynamic split pane styling based on theme
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'split-pane-theme';
    style.innerHTML = `
      .split-pane-divider {
        background-color: ${theme.colors.border} !important;
      }
      
      .split-pane-divider:hover {
        background-color: ${theme.name === 'dark' ? '#555' : '#ccc'} !important;
      }
    `;
    
    // Remove any existing style and append the new one
    const existingStyle = document.getElementById('split-pane-theme');
    if (existingStyle) {
      existingStyle.remove();
    }
    document.head.appendChild(style);
    
    return () => {
      // Clean up on unmount
      if (document.getElementById('split-pane-theme')) {
        document.getElementById('split-pane-theme').remove();
      }
    };
  }, [theme]);

  return (
    <AppContainer theme={theme}>
      <ControlPanel
        onRun={runCode}
        onSelectExample={setCode}
        isRunning={isRunning}
        showReference={showReference}
        onToggleReference={toggleReference}
      />
      <ContentContainer>
        {showReference ? (
          <Reference />
        ) : (
          <SplitPane
            split="vertical"
            sizes={sizes}
            onChange={setSizes}
          >
            <CodeEditor value={code} onChange={handleCodeChange} />
            <OutputPanel result={result} />
          </SplitPane>
        )}
      </ContentContainer>
    </AppContainer>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
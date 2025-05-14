import React, { useState } from 'react';
import SplitPane from 'split-pane-react/esm/SplitPane';
import styled from 'styled-components';
import 'split-pane-react/esm/themes/default.css';
import CodeEditor from './components/CodeEditor';
import OutputPanel from './components/OutputPanel';
import ControlPanel from './components/ControlPanel';
import Reference from './components/Reference';
import api from './services/api';
import examples from './examples/examples';

const AppContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #1e1e1e;
  color: #d4d4d4;
`;

const ContentContainer = styled.div`
  flex: 1;
  overflow: hidden;
`;

function App() {
  const [code, setCode] = useState(examples[0].code);
  const [result, setResult] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [sizes, setSizes] = useState(['60%', '40%']);
  const [showReference, setShowReference] = useState(false);

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

  return (
    <AppContainer>
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

export default App;
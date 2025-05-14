import React from 'react';
import Editor from '@monaco-editor/react';
import styled from 'styled-components';

const EditorContainer = styled.div`
  height: 100%;
  width: 100%;
  overflow: hidden;
`;

const CodeEditor = ({ value, onChange }) => {
  const handleEditorChange = (value) => {
    onChange(value);
  };

  return (
    <EditorContainer>
      <Editor
        height="100%"
        defaultLanguage="rust" // Using Rust for syntax highlighting as it's close to Verifex
        theme="vs-dark"
        value={value}
        onChange={handleEditorChange}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 17, // Increased by ~20% from 14
          fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
        }}
      />
    </EditorContainer>
  );
};

export default CodeEditor;